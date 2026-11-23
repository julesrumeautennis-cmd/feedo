/* @bruin
name: feedo.telemetry
type: duckdb.sql
materialization:
  type: table
depends:
  - feedo.schedule
columns:
  - name: sample_id
    checks:
      - name: unique
  - name: flow_lpm
    checks:
      - name: non_negative
@bruin */

-- Each simulated meter has incident-specific bias, sampling noise, and a
-- variable leak. Exercise IDs have deliberately different legitimate demand.
with offsets as (
    select *,
        case when has_leak then
            case when incident > 1000 then 3.4 else .45 + ((incident * 13) % 53) * .11 end
            else 0 end as lost_lpm,
        case when incident > 1000 then 0
            else (((incident * 43 + (case branch when 'A' then 1 else 9 end)) % 39) - 19) * .085 end as bias_lpm,
        (((incident + 7 * tick) % 11) - 5) * .05 as noise_lpm
    from feedo.schedule
)
select sample_id,
       greatest(0, round(expected_lpm + lost_lpm + bias_lpm + noise_lpm, 2)) as flow_lpm,
       round(310 - expected_lpm * .7 - lost_lpm * (1.5 + (incident % 5) * .4)
             + (((incident * 5 + tick) % 13) - 6) * .55, 2) as pressure_kpa
from offsets
