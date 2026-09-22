# frozen_string_literal: true

# Clock-driven stat simulation, mirroring src/lib/sim.ts one for one.
#
# Every live stat is pinned to a projected final total drawn around the prop's
# line, and can only accumulate as fast as the simulated game clock allows. A
# prop therefore drifts toward its line over a full game instead of clearing it
# in the first minute, and More/Less stays genuinely uncertain.
module Sim
  TICK_SECONDS = 0.9

  # Simulated game seconds added per tick: a 48-minute NBA game runs ~21 minutes.
  GAME_SECONDS_PER_TICK = 2

  QUARTERS = 4

  # Chance per tick that a live prop's line moves half a point.
  LIVE_LINE_NUDGE_CHANCE = 0.08

  # Pre-game lines move too, just far less often.
  PREGAME_LINE_NUDGE_CHANCE = 0.02

  # Ticks to hold on a fully final slate before reseeding so a demo never goes dead.
  RESTART_AFTER_TICKS = 16

  # Stats land within +/-45% of their line often enough to keep both sides live.
  PROJECTION_SPREAD = 0.18
  MIN_PROJECTION_FACTOR = 0.55
  MAX_PROJECTION_FACTOR = 1.45

  # Accumulate slightly ahead of a flat pace so totals land before the buzzer.
  PACE_LEAD = 1.06

  # min_step is the smallest realistic single addition: a made three is +1, a
  # completion is a chunk of yards. ceiling is roughly the best single-game
  # total on record, as a last-resort clamp.
  STAT_PROFILES = {
    "points" => { min_step: 1, max_step: 3, ceiling: 70 },
    "rebounds" => { min_step: 1, max_step: 1, ceiling: 30 },
    "assists" => { min_step: 1, max_step: 1, ceiling: 25 },
    "threes" => { min_step: 1, max_step: 1, ceiling: 14 },
    "receptions" => { min_step: 1, max_step: 1, ceiling: 20 },
    "pass_yds" => { min_step: 4, max_step: 24, ceiling: 550 },
    "rush_yds" => { min_step: 2, max_step: 14, ceiling: 296 }
  }.freeze

  module_function

  def profile(stat)
    STAT_PROFILES.fetch(stat, STAT_PROFILES["points"])
  end

  def quarter_seconds(sport)
    sport == "NBA" ? 12 * 60 : 15 * 60
  end

  def regulation_seconds(sport)
    quarter_seconds(sport) * QUARTERS
  end

  # Simulated seconds elapsed when a game sits at "Q<quarter> <minutes>:<seconds>".
  def elapsed_at(sport, quarter, minutes, seconds)
    quarter * quarter_seconds(sport) - ((minutes * 60) + seconds)
  end

  def format_clock(sport, elapsed_sec)
    return "Final" if elapsed_sec >= regulation_seconds(sport)

    per_quarter = quarter_seconds(sport)
    elapsed = [ elapsed_sec, 0 ].max
    quarter = (elapsed / per_quarter).floor + 1
    remaining = per_quarter - (elapsed % per_quarter)
    format("Q%d %d:%02d", quarter, (remaining / 60).floor, (remaining % 60).floor)
  end

  def clock_label(sport, status, elapsed_sec, start_label)
    case status
    when "scheduled" then start_label
    when "final" then "Final"
    else format_clock(sport, elapsed_sec)
    end
  end

  def game_progress(sport, elapsed_sec)
    clamp(elapsed_sec.to_f / regulation_seconds(sport), 0, 1)
  end

  def clamp(value, min, max)
    [ [ value, max ].min, min ].max
  end

  # Box-Muller, so projections cluster near the line instead of spreading flat.
  def gaussian
    u = [ rand, 1e-9 ].max
    v = rand
    Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math::PI * v)
  end

  # The total this player finishes the game with, drawn around the posted line.
  def project_final(line, stat)
    factor = clamp(1 + (gaussian * PROJECTION_SPREAD), MIN_PROJECTION_FACTOR, MAX_PROJECTION_FACTOR)
    clamp((line * factor).round, 0, profile(stat)[:ceiling])
  end

  # Where a player already in progress sits when the slate is seeded.
  def opening_stat(projected, stat, progress)
    jitter = 0.85 + (rand * 0.3)
    clamp((projected * clamp(progress, 0, 1) * jitter).round, 0, [ projected, profile(stat)[:ceiling] ].min)
  end

  # One tick of accumulation. The stat may only climb toward the pace the game
  # clock allows, and can never pass its projected final, so the "% of line" bar
  # tracks the game instead of pinning at 100%.
  def advance_stat(current, projected, stat, progress)
    stat_profile = profile(stat)
    pace = projected * clamp(progress * PACE_LEAD, 0, 1)
    return current if pace - current < stat_profile[:min_step]

    span = stat_profile[:max_step] - stat_profile[:min_step] + 1
    step = stat_profile[:min_step] + rand(span)
    [ current + step, projected, stat_profile[:ceiling] ].min
  end

  # Books post half points, so every line stays on that grid.
  def round_to_half(value)
    (value * 2).round / 2.0
  end

  # How far a line may wander from where it opened. Scaled to the number, so a
  # 268.5 pass-yard line can move 15 yards while a 2.5 three-pointer line cannot
  # collapse to 0.5.
  def line_bound(opening_line)
    round_to_half(clamp(opening_line * 0.12, 1, 15))
  end

  # Half-point random walk with a pull back toward the opening number.
  def nudge_line(line, opening_line)
    drift = rand < 0.5 ? -0.5 : 0.5
    toward_open = (opening_line <=> line) * 0.5
    nxt = rand < 0.35 ? line + toward_open : line + drift
    bound = line_bound(opening_line)
    round_to_half(clamp(nxt, [ 0.5, opening_line - bound ].max, opening_line + bound))
  end
end
