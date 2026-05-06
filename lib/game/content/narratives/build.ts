/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Stock narrative lines for a build (train units) turn. Each line is a
// short prose blurb the turn-report builder pairs with the structured
// outcome (which unit type, how many, on which tile). Lines are intentionally
// neutral about unit type so they fit ground / siege / air without rewrite.
//
// PR 6b seed: ~60 lines per action. PR 7 will scale to ~1000.
export const BUILD_NARRATIVES: string[] = [
  "Forges run hot through the night and the captains call out names from the muster roll.",
  "A line of new recruits steps forward in the mud, takes the oath, and is given a number.",
  "The drill yard rings with iron and shouted orders until the new banners are raised over the parade ground.",
  "A quartermaster signs his name to a long ledger and slides it across the table.",
  "Wagons of provisions roll into camp and the cooks start work before the first watch turns over.",
  "The smith's apprentice hammers out the last of the season's blade-edges; the new troopers buckle them on without looking.",
  "Old veterans walk the line of the new company and find one or two faces they recognize.",
  "A young general stands on a barrel and gives the speech he has been rehearsing for a week.",
  "A column of dust rises from the road as the new units march to their positions.",
  "Banners are raised, then lowered, then raised again, until the lines are dressed straight enough to satisfy the captain.",
  "Boots are issued. Cloaks are issued. The men who looked like farmers an hour ago now look like soldiers.",
  "The drum-major runs through the cadences twice. The third time, the new line keeps step.",
  "An old sergeant teaches the recruits how to sleep in armor; some of them will need it tonight.",
  "By dusk the new companies have a name, a number, and a place to stand when called.",
  "A priest sprinkles water on the company's standard and the captain pretends not to notice the trembling hands behind him.",
  "The army's tally board ticks up by another notch. A clerk underlines the new total in red.",
  "Outside the recruiting tent, a queue stretches into the evening. Tonight's batch is the largest in months.",
  "The forge-master's son pulls his first bellows shift; the iron sings well enough that no one corrects him.",
  "A cart of polished helms is hauled from the armory. Each new soldier takes one without quite believing it fits.",
  "The captain reads names aloud. Each man says \"here\" and steps forward; the captain marks a tally.",
  "Spear-points glitter in the rising sun as the new line forms ranks for inspection.",
  "Three women from the village arrive with their own swords; the captain swears them in without comment.",
  "An old widow brings her husband's helm to the recruit who used to plough her field.",
  "The drill yard is muddy, the rations are cold, and the new troopers wear it all like a badge.",
  "The bookkeeper closes the ledger, blows out the lamp, and goes home to a half-cold supper.",
  "A line of carts groans into camp under the weight of fresh shafts and steel.",
  "Two recruits trade their farm-clothes for issue-tunics and stand a little straighter.",
  "The smith's hammer falls one last time before he calls it a night and lets the apprentices finish.",
  "The captain inspects the new line, finds nothing terribly wrong, and gives the smallest of nods.",
  "A scribe records the company's name in the regimental book and dusts the ink with sand.",
  "Three squads form up in the rain and stand at attention without complaint until they're dismissed.",
  "An armorer makes the rounds, tightening straps, adjusting belts, swapping a cracked shield for a new one.",
  "The cook feeds the new company first; the veterans grumble but no one cuts the line.",
  "A messenger arrives just before dusk with orders for the new troops. The captain pockets them for morning.",
  "Banners snap in the wind. Drums sound. Boots fall in cadence. The new company has its first march.",
  "The senior captain takes the new lieutenant aside and offers three pieces of advice — only the third is useful.",
  "Tonight there is wine in the camp, and stories, and singing. Tomorrow there will be drills.",
  "A young recruit looks at his issue-helm, then at the moon, then at his hands. He puts the helm on.",
  "The horses arrive late but they arrive. The cavalry-master walks the line and looks pleased.",
  "A heron lifts off the river as the new company crosses the bridge for the first time.",
  "The training field is churned to mud. The new soldiers wear the mud like camouflage by lunchtime.",
  "A recruiter from a different company tries to poach a few of yours. He leaves with bruised pride.",
  "The standard-bearer practices raising and lowering the flag until his arms ache.",
  "An old scout shakes his head, mutters \"good enough,\" and saddles his horse.",
  "The smith's wife brings the captain a new whetstone. She does this every season; the captain keeps a stack.",
  "A trumpet sounds in the morning and the new company is on its feet before the second note.",
  "An armory door swings open and out come the racks of fresh weapons, smelling of oil and steel.",
  "The veterans test the new gear on the new soldiers; some of it fails and is sent back, but most holds.",
  "A roll of parchment lists every name. The captain reads them again before bed, slow, like a prayer.",
  "Three carts of grain. Two carts of bandages. One cart of arrowheads. The clerk writes it all down.",
  "The squad commander walks the line, pulls a buckle tight here, straightens a cap there, says nothing.",
  "Recruits drill in the rain because the captain says rain doesn't postpone war.",
  "A grandmother in the village waves to her grandson in the new column. He pretends not to see, and waves back later when the others aren't looking.",
  "A hawk circles the camp through the morning. Some of the older soldiers take it as a good omen.",
  "The forge cools. The captains close the books. Tomorrow there will be more to do.",
  "Out past the perimeter, a fox watches the camp through the brush. The watchmen don't notice. The fox does.",
  "Two recruits start a fight over a blanket. The sergeant ends it with three words and a glare.",
  "A wagon throws a wheel; the smith fixes it before sundown and the column moves on.",
  "Tonight's password is the captain's youngest daughter's name. Tomorrow it will change.",
  "The new company is fed, clothed, armed, and named. The captain considers it a good day's work.",
];
