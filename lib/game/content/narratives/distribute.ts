/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Stock narrative lines for assigning a tile its land type. The structured
// outcome carries which type was chosen — these lines are intentionally
// neutral about military / food / magic so they don't have to be split.
const HUMAN_DISTRIBUTE_NARRATIVES: string[] = [
  "Surveyors stake out the boundary and hammer in the markers before the dew has burned off.",
  "Your stewards walk the land before noon and decide what it will be by the evening fire.",
  "An old farmer is asked his opinion on the soil; he gives it freely and at length.",
  "A flag is raised on the highest point and the captain reads the writ aloud to a half-attentive crowd.",
  "The new charter is signed under a tree the steward says her grandfather planted.",
  "A team of carpenters arrives at dawn and the framing is up by sundown.",
  "Word goes out on the morning post: this land is now a working part of the holding.",
  "The land's first foundation stone is laid by the youngest steward, who is solemn about it.",
  "A surveyor's chain is dragged across the field; the fence-posts go in before the sun is high.",
  "Three measuring posts and a rope. A clear morning. A satisfied steward.",
  "The villagers gather at the boundary line to watch the writ being read; only the children stay till the end.",
  "An apothecary takes a soil sample, bites it, and pronounces it acceptable.",
  "The steward signs the assignment book with her left hand because her right is sore from yesterday.",
  "A boundary stone is set; the carver dates it with the year, the steward signs it with her seal.",
  "An old soldier remarks that the land used to belong to a different family. The steward writes that down.",
  "By midday the new role is decided. By dusk the first work is underway.",
  "A pair of oxen plough their first furrow on the new boundary line. The work is done well.",
  "The steward's clerk records the assignment in three ledgers and seals all three.",
  "A cart of timber is delivered before the writ is even signed. The carter has done this before.",
  "Two workers raise the first beam together. They have done this so many times it looks like a single motion.",
  "The land's purpose is decided over a slow cup of tea and a long silence.",
  "A boy runs from the steward's tent to the village with the news. He arrives breathless.",
  "The first watch-fire is lit on the new boundary. By morning it will be a permanent fixture.",
  "An old shepherd nods his approval and goes back to his flock.",
  "A scribe stamps the new role into the master ledger and dusts the ink with sand.",
  "The senior captain inspects the assignment and finds it satisfactory. He says so without smiling.",
  "By dusk the new posting has its sign, its number, and a record in three books.",
  "A line of carts heads toward the new posting before the assignment is even fully signed.",
  "The villagers seem pleased. The villagers always seem pleased; you've learned not to read too much into it.",
  "A small ceremony is held at the boundary. Three sentences are spoken; the writ is sealed.",
  "An old steward walks the perimeter once, slowly, before signing off on the new use.",
  "A hawk lands on the marker stone. The steward takes this as a sign and continues with her work.",
  "The new charter is read from a stump in the middle of the field. Everyone leaves before the steward is finished.",
  "A bag of seed-grain is set aside in case the assignment ever needs to be reconsidered.",
  "An old map is annotated in fresh ink. Future generations will wonder who did the lettering.",
  "The clerk closes the assignment book and locks it in the iron chest with the rest.",
  "Workers are hired before the writ is signed; the writ catches up with them by sunset.",
  "A cart of stone is delivered. A cart of timber follows. The new posting begins to look like itself.",
  "The steward writes a one-line note to the chief: \"It is done.\"",
  "A line of drystone wall is laid by hand. By dusk the first hundred paces are up.",
  "The villagers' children play along the new boundary line until the steward shoos them off.",
  "An assistant signs the new posting into the regional record and stamps it twice for good measure.",
  "The old order is set aside; the new order is laid down without ceremony.",
  "A dog watches the steward work for an hour, then loses interest.",
  "The new posting is staffed by mid-afternoon. By evening the first reports are coming in.",
  "A cart-driver delivers the writ to the regional office. He gets a bowl of stew for his trouble.",
  "By dusk the land has a new name on the map and a new line in the ledger.",
  "An old man tells the story of the land's previous use, but no one is taking notes.",
  "The steward seals the writ with her ring and tucks it into the inside pocket of her coat.",
];

const AI_DISTRIBUTE_NARRATIVES: string[] = [
  "A measuring chain is dragged across the field; the steward marks the corners with white stones.",
  "The new charter is read out loud at the boundary, and a few villagers nod as if they expected it.",
  "Workers carry the writ in a small wooden box from the manor to the boundary post.",
  "The steward signs the assignment book with deliberate care; her clerk dusts it twice.",
  "A small ceremony at the boundary; a single bell is rung, the writ is sealed, and the work begins.",
  "The land's purpose is decided, the marker is placed, and the steward goes home to a hot supper.",
  "An old shepherd watches from a stone wall and gives no opinion; the steward takes it as approval.",
  "A line of carts brings tools to the new posting before the writ has fully dried.",
  "The blacksmith brings a new hinge for the boundary gate; it is mounted before the writ is signed.",
  "A boy is sent to fetch the manor's seal; he runs both ways and arrives back panting but proud.",
  "The steward's seal cracks the wax in the shape of a small wheel; the writ is filed.",
  "A hand-cart of stakes and rope is unloaded at the boundary; the laying-out begins immediately.",
  "An apothecary tests the soil one last time, finds it suitable, and signs the second clause of the writ.",
  "Three farmers from the village offer to do the boundary fencing; the steward writes their names down.",
  "A pair of oxen is led onto the new field for the first ploughing; they accept the work without fuss.",
  "The senior steward inspects the new posting and finds it acceptable; she says so without smiling.",
  "A stack of timber is unloaded at the corner of the new field; the framing crew arrives within the hour.",
  "An old veteran salutes the new boundary marker on his way past; the steward returns the salute.",
  "The clerk records the new use in the regional ledger and signs it twice for the records department's pleasure.",
  "A small dog watches the steward sign the writ; the steward gives it a piece of bread and the dog leaves.",
];

export const DISTRIBUTE_NARRATIVES: string[] = [
  ...HUMAN_DISTRIBUTE_NARRATIVES,
  ...AI_DISTRIBUTE_NARRATIVES,
];
