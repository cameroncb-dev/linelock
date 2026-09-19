# frozen_string_literal: true

module Slate
  module_function

  def seed
    t = now_ms
    [
      prop("nba-luka-pts", "NBA", "Luka Dončić", "LAL", "BOS", "PG", "points", "Points", 28.5, 29.5, 16, "live", "Q2 4:18", t),
      prop("nba-tatum-pts", "NBA", "Jayson Tatum", "BOS", "LAL", "SF", "points", "Points", 26.5, 26.5, 12, "live", "Q2 4:18", t),
      prop("nba-ad-reb", "NBA", "Anthony Davis", "DAL", "LAL", "C", "rebounds", "Rebounds", 11.5, 11.5, 7, "live", "Q2 4:18", t),
      prop("nba-white-ast", "NBA", "Derrick White", "BOS", "LAL", "SG", "assists", "Assists", 5.5, 5.5, 3, "live", "Q2 4:18", t),
      prop("nba-jokic-pts", "NBA", "Nikola Jokić", "DEN", "PHX", "C", "points", "Points", 27.5, 27.5, nil, "scheduled", "8:10 PM ET", t),
      prop("nba-jokic-reb", "NBA", "Nikola Jokić", "DEN", "PHX", "C", "rebounds", "Rebounds", 12.5, 12.5, nil, "scheduled", "8:10 PM ET", t),
      prop("nba-booker-pts", "NBA", "Devin Booker", "PHX", "DEN", "SG", "points", "Points", 25.5, 24.5, nil, "scheduled", "8:10 PM ET", t),
      prop("nba-kd-threes", "NBA", "Kevin Durant", "HOU", "GSW", "SF", "threes", "3-Pointers", 2.5, 2.5, 1, "live", "Q1 2:40", t),
      prop("nba-curry-threes", "NBA", "Stephen Curry", "GSW", "HOU", "PG", "threes", "3-Pointers", 4.5, 4.5, 2, "live", "Q1 2:40", t),
      prop("nba-edwards-pts", "NBA", "Anthony Edwards", "MIN", "NYK", "SG", "points", "Points", 27.5, 28.5, nil, "scheduled", "9:30 PM ET", t),
      prop("nfl-mahomes-pass", "NFL", "Patrick Mahomes", "KC", "BUF", "QB", "pass_yds", "Pass Yds", 268.5, 272.5, 142, "live", "Q2 11:04", t),
      prop("nfl-allen-pass", "NFL", "Josh Allen", "BUF", "KC", "QB", "pass_yds", "Pass Yds", 254.5, 251.5, 118, "live", "Q2 11:04", t),
      prop("nfl-cmc-rush", "NFL", "Christian McCaffrey", "SF", "SEA", "RB", "rush_yds", "Rush Yds", 78.5, 78.5, nil, "scheduled", "Sun 4:25 PM", t),
      prop("nfl-kupp-rec", "NFL", "Cooper Kupp", "SEA", "SF", "WR", "receptions", "Receptions", 6.5, 6.5, nil, "scheduled", "Sun 4:25 PM", t),
      prop("nfl-jefferson-rec", "NFL", "Justin Jefferson", "MIN", "GB", "WR", "receptions", "Receptions", 7.5, 7.5, 4, "final", "Final", t),
      prop("nfl-hurts-rush", "NFL", "Jalen Hurts", "PHI", "DAL", "QB", "rush_yds", "Rush Yds", 36.5, 34.5, 22, "live", "Q3 8:51", t)
    ]
  end

  def now_ms
    (Time.now.to_f * 1000).to_i
  end

  def prop(id, sport, player, team, opponent, position, stat, stat_label, line, opening, live_stat, status, clock, t)
    {
      "id" => id,
      "sport" => sport,
      "player" => player,
      "team" => team,
      "opponent" => opponent,
      "position" => position,
      "stat" => stat,
      "statLabel" => stat_label,
      "line" => line,
      "openingLine" => opening,
      "liveStat" => live_stat,
      "gameStatus" => status,
      "clock" => clock,
      "updatedAt" => t
    }
  end
end
