/* @bruin
name: feedo.schedule
type: duckdb.sql
materialization:
  type: table
columns:
  - name: sample_id
    checks:
      - name: unique
      - name: not_null
@bruin */

-- Synthetic fixture bookings; values describe the exercise, not the building.
with slots as (
    select incident, tick, branch, side,
           (incident + side) % 2 = 0 as has_leak,
           (incident * 17 + side * 29) % 31 as demand_group
    from (select unnest(range(1, 201)) as incident union all values (1001), (1002)) incidents
    cross join (values ('A', 1), ('B', 0)) as circuits(branch, side)
    cross join range(6) as ticks(tick)
)
select
    concat_ws('-', incident, branch, tick) as sample_id,
    incident, branch, tick, has_leak,
    case
      when incident = 1001 then (case when branch = 'A' then 0.0 else 8.0 end)
      when incident = 1002 then (case when branch = 'B' then 2.0 else 10.0 end)
      when demand_group < 12 then 0.0
      else round(1.2 + demand_group * .42 + (tick % 3) * .3, 2)
    end as expected_lpm
from slots
