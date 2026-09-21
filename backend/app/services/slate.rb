# frozen_string_literal: true

# Demo slate, mirroring src/server/slate.ts. Props are grouped into games so
# every card in a game shares one clock, and stat accumulation has something to
# be paced against.
#
# Players are real; every line, projection and score here is invented.
module Slate
  module_function

  def games
    [
      game("nba-lal-bos", "NBA", "live", Sim.elapsed_at("NBA", 2, 4, 18), 0, "7:30 PM ET"),
      game("nba-hou-gsw", "NBA", "live", Sim.elapsed_at("NBA", 1, 2, 40), 0, "8:00 PM ET"),
      game("nba-dal-mem", "NBA", "live", Sim.elapsed_at("NBA", 3, 7, 5), 0, "7:00 PM ET"),
      game("nba-den-phx", "NBA", "scheduled", 0, 210, "8:10 PM ET"),
      game("nba-min-nyk", "NBA", "scheduled", 0, 690, "9:30 PM ET"),
      game("nfl-kc-buf", "NFL", "live", Sim.elapsed_at("NFL", 2, 11, 4), 0, "Sun 1:00 PM"),
      game("nfl-phi-dal", "NFL", "live", Sim.elapsed_at("NFL", 3, 8, 51), 0, "Sun 1:00 PM"),
      game("nfl-sf-sea", "NFL", "scheduled", 0, 420, "Sun 4:25 PM"),
      game("nfl-min-gb", "NFL", "final", 3600, 0, "Sun 1:00 PM")
    ]
  end

  def seed
    [
      prop("nba-luka-pts", "nba-lal-bos", "NBA", "Luka Dončić", "LAL", "BOS", "PG", "points", "Points", 28.5, 29.5),
      prop("nba-tatum-pts", "nba-lal-bos", "NBA", "Jayson Tatum", "BOS", "LAL", "SF", "points", "Points", 26.5, 26.5),
      prop("nba-white-ast", "nba-lal-bos", "NBA", "Derrick White", "BOS", "LAL", "SG", "assists", "Assists", 5.5, 5.5),
      prop("nba-ad-reb", "nba-dal-mem", "NBA", "Anthony Davis", "DAL", "MEM", "C", "rebounds", "Rebounds", 11.5, 11.5),
      prop("nba-kd-threes", "nba-hou-gsw", "NBA", "Kevin Durant", "HOU", "GSW", "SF", "threes", "3-Pointers", 2.5, 2.5),
      prop("nba-curry-threes", "nba-hou-gsw", "NBA", "Stephen Curry", "GSW", "HOU", "PG", "threes", "3-Pointers", 4.5, 4.5),
      prop("nba-jokic-pts", "nba-den-phx", "NBA", "Nikola Jokić", "DEN", "PHX", "C", "points", "Points", 27.5, 27.5),
      prop("nba-jokic-reb", "nba-den-phx", "NBA", "Nikola Jokić", "DEN", "PHX", "C", "rebounds", "Rebounds", 12.5, 12.5),
      prop("nba-booker-pts", "nba-den-phx", "NBA", "Devin Booker", "PHX", "DEN", "SG", "points", "Points", 25.5, 24.5),
      prop("nba-edwards-pts", "nba-min-nyk", "NBA", "Anthony Edwards", "MIN", "NYK", "SG", "points", "Points", 27.5, 28.5),
      prop("nfl-mahomes-pass", "nfl-kc-buf", "NFL", "Patrick Mahomes", "KC", "BUF", "QB", "pass_yds", "Pass Yds", 268.5, 272.5),
      prop("nfl-allen-pass", "nfl-kc-buf", "NFL", "Josh Allen", "BUF", "KC", "QB", "pass_yds", "Pass Yds", 254.5, 251.5),
      prop("nfl-hurts-rush", "nfl-phi-dal", "NFL", "Jalen Hurts", "PHI", "DAL", "QB", "rush_yds", "Rush Yds", 36.5, 34.5),
      prop("nfl-cmc-rush", "nfl-sf-sea", "NFL", "Christian McCaffrey", "SF", "SEA", "RB", "rush_yds", "Rush Yds", 78.5, 78.5),
      prop("nfl-kupp-rec", "nfl-sf-sea", "NFL", "Cooper Kupp", "SEA", "SF", "WR", "receptions", "Receptions", 6.5, 6.5),
      prop("nfl-jefferson-rec", "nfl-min-gb", "NFL", "Justin Jefferson", "MIN", "GB", "WR", "receptions", "Receptions", 7.5, 7.5)
    ]
  end

  def now_ms
    (Time.now.to_f * 1000).to_i
  end

  def game(id, sport, status, elapsed_sec, starts_in_sec, start_label)
    {
      "id" => id,
      "sport" => sport,
      "status" => status,
      "elapsedSec" => elapsed_sec,
      "startsInSec" => starts_in_sec,
      "startLabel" => start_label
    }
  end

  def prop(id, game_id, sport, player, team, opponent, position, stat, stat_label, line, opening)
    {
      "id" => id,
      "gameId" => game_id,
      "sport" => sport,
      "player" => player,
      "team" => team,
      "opponent" => opponent,
      "position" => position,
      "stat" => stat,
      "statLabel" => stat_label,
      "line" => line,
      "openingLine" => opening
    }
  end
end
