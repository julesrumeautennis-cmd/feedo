/* @bruin
name: feedo.observations
type: duckdb.sql
materialization:
  type: table
depends:
  - feedo.schedule
  - feedo.telemetry
columns:
  - name: observation_id
    checks:
      - name: unique
      - name: not_null
custom_checks:
  - name: six_ticks_per_circuit
    query: SELECT COUNT(*) FROM feedo.observations WHERE samples <> 6
    value: 0
  - name: both_circuits_present
    query: SELECT COUNT(*) FROM (SELECT incident FROM feedo.observations GROUP BY incident HAVING COUNT(*) <> 2 OR SUM(target) <> 1)
    value: 0
@bruin */

select
    concat_ws('-', s.incident, s.branch) as observation_id,
    s.incident, s.branch, cast(s.has_leak as int) as target,
    count(t.sample_id) as samples,
    round(avg(s.expected_lpm), 3) as expected,
    round(avg(t.flow_lpm), 3) as flow,
    round(avg(310 - s.expected_lpm * .7 - t.pressure_kpa), 3) as pressure_loss
from feedo.schedule s
left join feedo.telemetry t using (sample_id)
group by s.incident, s.branch, s.has_leak
