# frozen_string_literal: true

class EntryValidator
  MIN_LEGS = 2
  MAX_LEGS = 6
  MULTIPLIERS = { 2 => 3, 3 => 5, 4 => 10, 5 => 20, 6 => 25 }.freeze

  def initialize(legs, props_by_id)
    @legs = Array(legs)
    @props_by_id = props_by_id
  end

  def validate
    if @legs.length < MIN_LEGS || @legs.length > MAX_LEGS
      return failure(400, "Slip needs #{MIN_LEGS}–#{MAX_LEGS} picks.")
    end

    seen = {}
    drifted = []

    @legs.each do |leg|
      side = leg["side"] || leg[:side]
      prop_id = leg["propId"] || leg[:propId]
      locked = leg["lockedLine"] || leg[:lockedLine]

      unless %w[more less].include?(side)
        return failure(400, "Each pick must be more or less.")
      end
      if seen[prop_id]
        return failure(400, "Duplicate player-stat on the same slip.")
      end
      seen[prop_id] = true

      prop = @props_by_id[prop_id]
      return failure(400, "Unknown prop #{prop_id}.") unless prop

      if prop["gameStatus"] == "final"
        return failure(409, "#{prop["player"]} is already final.")
      end
      drifted << prop["id"] if prop["line"].to_f != locked.to_f
    end

    if drifted.any?
      return {
        ok: false,
        status: 409,
        error: "A line moved after you locked the pick. Re-lock to submit.",
        drifted: drifted
      }
    end

    {
      ok: true,
      multiplier: MULTIPLIERS[@legs.length] || 1,
      legs: @legs
    }
  end

  private

  def failure(status, error)
    { ok: false, status: status, error: error }
  end
end
