"""Build the Bruin-derived demo snapshot and fit a two-feature logistic classifier."""
import argparse
import csv
import io
import json
import math
import os
from pathlib import Path
import statistics
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "data/feedo/pipeline.yml"
CONFIG_TEMPLATE = PIPELINE.with_name("connection.example.yml")
ARTIFACT = ROOT / "src/training/calibration.json"


def load_observations(bruin):
    with tempfile.TemporaryDirectory() as temp:
        # Bruin adds connection file names to .gitignore. Give it a private
        # working copy; the versioned template contains no credentials.
        config = Path(temp) / ".bruin.yml"
        config.write_text(CONFIG_TEMPLATE.read_text())
        env = dict(os.environ, FEEDO_TRAINING_DB=str(Path(temp) / "training.duckdb"))
        for command in ("validate", "run"):
            subprocess.run([bruin, command, "--config-file", config, PIPELINE],
                           env=env, cwd=ROOT, check=True)
        result = subprocess.run([
            bruin, "query", "--config-file", config, "-c", "feedo-local", "-o", "csv",
            "-q", "SELECT * FROM feedo.observations ORDER BY incident, branch",
        ], env=env, cwd=ROOT, text=True, stdout=subprocess.PIPE, check=True)
    rows = []
    for row in csv.DictReader(io.StringIO(result.stdout)):
        rows.append({
            "incident": int(row["incident"]), "branch": row["branch"],
            "target": int(row["target"]), "flow": float(row["flow"]),
            "expected": float(row["expected"]), "pressureLoss": float(row["pressure_loss"]),
        })
    return rows


def features(row):
    return (row["flow"] - row["expected"], row["pressureLoss"])


def probability(weights, inputs):
    return 1 / (1 + math.exp(-(weights[0] + sum(w*x for w, x in zip(weights[1:], inputs)))))


def train(rows):
    # Both circuits from any incident stay on the same side of the split.
    training = [r for r in rows if r["incident"] < 1000 and r["incident"] % 5]
    testing = [r for r in rows if r["incident"] < 1000 and r["incident"] % 5 == 0]
    columns = list(zip(*(features(r) for r in training)))
    center = [statistics.mean(column) for column in columns]
    scale = [statistics.pstdev(column) or 1 for column in columns]

    def normalize(row):
        return [(value - mu)/sd for value, mu, sd in zip(features(row), center, scale)]

    samples = [(normalize(r), r["target"]) for r in training]
    weights = [0.0, 0.0, 0.0]
    for _ in range(800):
        grad = [0.0, 0.0, 0.0]
        for inputs, label in samples:
            delta = probability(weights, inputs) - label
            for j, value in enumerate([1, *inputs]):
                grad[j] += value * delta
        for j in range(len(weights)):
            weights[j] -= .35 * (grad[j]/len(samples) + (.002 * weights[j] if j else 0))

    # Evaluate the task the scout actually performs: rank the two circuits.
    def correct_incidents(rank):
        ids = sorted({r["incident"] for r in testing})
        return sum(max((r for r in testing if r["incident"] == i), key=rank)["target"] for i in ids)

    cases = {}
    for variant, incident in (("A", 1001), ("B", 1002)):
        cases[variant] = [{k: r[k] for k in ("branch", "flow", "expected", "pressureLoss")}
                          for r in rows if r["incident"] == incident]
    return {
        "model": {
            "kind": "logistic-regression", "features": ["flowMinusExpected", "pressureLoss"],
            "center": [round(v, 7) for v in center], "scale": [round(v, 7) for v in scale],
            "weights": [round(v, 7) for v in weights],
        },
        "evaluation": {
            "trainingIncidents": len(training)//2, "heldOutIncidents": len(testing)//2,
            "modelCorrect": correct_incidents(lambda r: probability(weights, normalize(r))),
            "rawFlowBaselineCorrect": correct_incidents(lambda r: r["flow"]),
            "source": "simulated",
        },
        "cases": cases,
    }


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--bruin", default="bruin")
    cli.add_argument("--check", action="store_true", help="Compare against committed snapshot")
    args = cli.parse_args()
    artifact = train(load_observations(args.bruin))
    rendered = json.dumps(artifact, indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if ARTIFACT.read_text() != rendered:
            raise SystemExit("Model snapshot differs. Rebuild it and review the dataset or changes.")
    else:
        ARTIFACT.write_text(rendered)
    print(json.dumps(artifact["evaluation"]))
