# frozen_string_literal: true

# Validates a slip. Mirrored by src/lib/entries.ts: both backends must return
# the same status and the same error text for the same body, malformed input
# included.
class EntryValidator
  MIN_LEGS = 2
  MAX_LEGS = 6
  MULTIPLIERS = { 2 => 3, 3 => 5, 4 => 10, 5 => 20, 6 => 25 }.freeze
  LEG_SHAPE_ERROR = "Each pick needs a propId, a side and a numeric lockedLine."

  def initialize(legs, props_by_id)
    @legs = legs.is_a?(Array) ? legs : []
    @props_by_id = props_by_id
  end

  def validate
    if @legs.length < MIN_LEGS || @legs.length > MAX_LEGS
      return failure(400, "Slip needs #{MIN_LEGS}–#{MAX_LEGS} picks.")
    end

    seen = {}
    drifted = []

    @legs.each do |raw_leg|
      return failure(400, LEG_SHAPE_ERROR) unless leg_shape?(raw_leg)

      leg = raw_leg.transform_keys(&:to_s)
      return failure(400, "Each pick must be more or less.") unless %w[more less].include?(leg["side"])
      return failure(400, "Duplicate player-stat on the same slip.") if seen[leg["propId"]]

      seen[leg["propId"]] = true

      prop = @props_by_id[leg["propId"]]
      return failure(400, "Unknown prop #{leg["propId"]}.") unless prop
      return failure(409, "#{prop["player"]} is already final.") if prop["gameStatus"] == "final"

      drifted << prop["id"] if prop["line"].to_f != leg["lockedLine"].to_f
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

  def leg_shape?(leg)
    return false unless leg.is_a?(Hash)

    normalized = leg.transform_keys(&:to_s)
    normalized["propId"].is_a?(String) && normalized["lockedLine"].is_a?(Numeric)
  end

  def failure(status, error)
    { ok: false, status: status, error: error }
  end
end
