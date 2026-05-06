/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Attack narratives are TEMPLATED rather than picked whole, because they need
// to reference real numbers (units sent, casualties, outcome). The turn-report
// builder picks one fragment from each section, in order, and joins them with
// the structured details to form a 1–3-line battle account.
//
// Example final line:
//  "Your forces marched out before dawn. After a brutal skirmish across the
//   border line, the tile fell to your colors. You lost 23 ground; they lost 41."

export const ATTACK_OPENINGS: string[] = [
  "Your forces marched out before dawn.",
  "Your captains gave the order at sundown.",
  "A fast-moving column was on the move before the first watch turned over.",
  "Your scouts struck before the enemy's bell could ring.",
  "Your column crossed the border under a clear sky.",
  "The advance was quiet, deliberate, and shorter than expected.",
  "A storm was breaking as the column moved out; the timing was deliberate.",
  "Your line moved up the slope in good order.",
  "Your siege engines rolled forward in the morning fog.",
  "Your air-corps came down through the clouds without warning.",
  "The cavalry left the camp at a hard canter and did not look back.",
  "Your captains chose the moment carefully and moved as one.",
  "The advance crossed the river before the enemy could raise an alarm.",
  "Your forward squads engaged before the main body had finished forming up.",
  "The column moved with the patience of a tide and the speed of a hawk.",
];

export const ATTACK_MIDDLES: string[] = [
  "After a brutal skirmish across the border line",
  "After exchanges of fire that lasted until the sun was high",
  "After a slow grinding push that crushed the defender's first line",
  "After a feint to the left and a hard drive on the right",
  "After three waves of attack and a final push at dusk",
  "After a clean charge that broke the defender's nerve",
  "After a long, ugly afternoon of close work",
  "After repeated assaults that bled both sides",
  "After a precise siege that opened the wall in the third hour",
  "After an air-strike that confused the defenders' formation",
  "After a feigned withdrawal that drew the enemy out of position",
  "After a bitter contest of inches that neither side enjoyed",
  "After a swift and decisive engagement",
  "After a battle that the historians will argue over for a generation",
];

export const ATTACK_CAPTURED_CLOSERS: string[] = [
  "the tile fell to your colors.",
  "the defenders broke and the ground was yours.",
  "the boundary post was thrown down and a new banner went up.",
  "the enemy's standard was taken down and burned.",
  "the captain raised your flag over the keep before sundown.",
  "the position was held and signed into your name.",
  "the territory was claimed and the survivors marched out under guard.",
];

export const ATTACK_REPELLED_CLOSERS: string[] = [
  "the line held against you, and your forces fell back.",
  "the defense was deeper than your scouts had reported, and the assault was called off.",
  "the attack broke against the wall and the column withdrew.",
  "your captains called the retreat before things got worse.",
  "the defenders' arrows found too many marks, and the column pulled back at dusk.",
  "the enemy's reserves arrived sooner than expected, and your column was forced to break off.",
];

export const ATTACK_STALEMATE_CLOSERS: string[] = [
  "neither side could hold the field, and at nightfall both withdrew.",
  "the contest ended without a clear victor and the survivors retreated to their lines.",
  "the engagement bled both armies and decided nothing.",
  "the day ended with no banner changed and a great many dead.",
];
