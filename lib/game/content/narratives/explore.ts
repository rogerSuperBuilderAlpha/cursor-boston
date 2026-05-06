/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Stock narrative lines for an explore turn. The turn-report builder picks
// one line at random (seeded) and may layer on additional structured detail
// (artifact found, hostile neighbors, etc.) before returning to the client.
//
// PR 6a seed: ~60 lines. PR 7 will scale to ~1000 via AI-generated bulk +
// hand-curated contributor PRs.
export const EXPLORE_NARRATIVES: string[] = [
  "Your scouts crest a low ridge and look down on a stretch of land no banner has claimed in living memory.",
  "A trail of cold ash leads your party into a clearing where a single tree grows in the middle of a stone circle.",
  "The fog parts as your column rides through it, revealing a long valley still carrying the morning's first frost.",
  "A river bends here, slow and deep. The reeds along its bank are pressed flat as if something large recently passed.",
  "Your scouts return with a worn map, drawn in a hand none of them recognize, that matches the ground beneath their feet.",
  "Three crows circle the same patch of ground for an hour. When your scouts arrive, the crows are gone.",
  "A boundary stone leans drunkenly in tall grass. The name carved into it has been worn to a single half-legible letter.",
  "The land here slopes gently toward a freshwater spring that bubbles up cold even at midday.",
  "A row of half-buried clay pots in the soil suggests someone kept a household here, long enough ago that the trees have grown over the foundation.",
  "Your point rider waves you forward to a clearing where wild apple trees grow in suspiciously even rows.",
  "A flock of sheep grazes here without a shepherd. Your scouts watch them for an hour before deciding they are simply free.",
  "The smell of wood smoke leads you to an empty firepit, the coals still warm. Whoever was here left without taking their boots.",
  "Your column passes a roadside shrine to a god none of you can name. Someone has left a fresh offering of grain.",
  "A field of wildflowers stretches almost to the horizon. The bees here are unusually large and unusually friendly.",
  "Your scouts find an abandoned cart on the road, fully laden with grain. No bodies, no struggle, no clear reason.",
  "A standing stone marks the corner of this land, and the moss on its north face is older than any tree in sight.",
  "The forest thins here into a meadow that holds the last of the summer's warmth even as the wind changes.",
  "Your scouts report a low, regular thumping from beneath the ground. By the time you arrive, it has stopped.",
  "A woman in a gray cloak watches your column from a distant hill. By the time anyone is sent to greet her, she is gone.",
  "The land descends into a bowl-shaped valley sheltered from the wind on every side. A natural stronghold, if you wanted one.",
  "Your party finds a milestone reading \"34\" in old script. There is no road, and no obvious place 34 of anything could lead.",
  "Twin oaks stand at the edge of this land, branches grown together overhead, framing the way in like a doorway.",
  "A fox pauses on the path long enough for your captain to note its colors, then disappears into the undergrowth with deliberate dignity.",
  "The grass here grows in patches the shape of old foundations. Whatever stood here was carefully taken apart, not destroyed.",
  "Your scouts find a child's wooden sword stuck in a tree, point first, at exactly the height a man would throw it from horseback.",
  "A creek runs cold and clear through the center of this land, with stepping stones placed by hands that knew their work.",
  "The path opens onto a high meadow with a view of three valleys. From here you can see further than from any tower you've owned.",
  "A herd of deer moves through the trees ahead of you and does not bolt. They are accustomed to people, but no people are here.",
  "Your scouts find a row of beehives, freshly tended, the honey still warm on the comb. The keeper is nowhere to be seen.",
  "A storm-felled tree blocks the path. Cutting through it reveals a copper coin lodged deep in the heartwood.",
  "The land here is unusually quiet. No birds, no wind, just the sound of your own column moving through it.",
  "Your scouts find a freshly-dug grave with no marker, then a second, then a third. The shovel is leaned neatly against a tree.",
  "A circle of mushrooms surrounds a patch of unburned grass in the middle of a charred field. No one will say what burned here.",
  "Your party crosses a stone bridge that maps its own footing as you walk. The mason carved his name on the keystone: just one letter, M.",
  "An old woman is sitting at a crossroads carving wooden birds. She offers one to your captain. He accepts, awkwardly, and the woman smiles.",
  "Your scouts return with the news that there is, simply, nothing here yet. A blank page of land waiting to be written on.",
  "The ground rises gently to a long ridge that hums faintly underfoot. Old roads run beneath it, your scouts insist.",
  "A waterfall the height of three men crashes into a pool that holds the reflection of the moon even at noon.",
  "Your captain finds a war-band's pennant stuck in the dirt at the edge of this land, faded past recognition. He buries it without comment.",
  "Wild horses graze in a clearing here. They watch you with the easy patience of creatures that have never been chased.",
  "A flagstone road, well-laid and overgrown, runs straight through this land for half a mile and then simply stops.",
  "Your scouts find a barrow mound that no shovel has touched. The wind around it carries an old smell, like a kept room.",
  "The forest opens onto a salt lick where game trails converge from a dozen directions. A hunter's paradise, if you have hunters.",
  "Your column passes an abandoned watchtower, walls intact, door splintered from inside. Whoever fled here ran outward, not in.",
  "A patch of wild barley grows here, planted in rows by hands long gone. The grain is plump and ready.",
  "Your scouts find a child's shoe by the side of a stream. It is the only sign anyone has ever come this way.",
  "Three cairns stand on the highest point of this land. They are not graves; the stones are too small.",
  "A copse of wild pear trees grows here, their fruit just beginning to turn. Bees move through them with unhurried purpose.",
  "Your captain notices a flat stone in the meadow that rings under a horse's hoof. Whatever is beneath it, it can wait.",
  "The wind carries a song from somewhere, in a language no one in your party speaks. By dusk it has faded.",
  "Your scouts find a millstone in the woods, half-overgrown, the cut marks of an old craftsman still sharp. There is no mill in sight.",
  "A pair of swans glides across a pond in the center of this land, watching your column without alarm.",
  "Your party finds a low stone wall that runs straight east-west for two hundred paces and ends in nothing on either side.",
  "An apothecary's marker — a brass mortar mounted on a post — stands at the edge of this land. The post is fresh; the brass is old.",
  "A ring of standing stones surrounds a dry well. Your scouts agree the well was filled in deliberately, and recently.",
  "Your captain dismounts to inspect a footprint twice the size of a man's. He gets back on his horse without comment.",
  "A flock of geese passes overhead in a perfect arrowhead, as if the sky itself were pointing forward.",
  "Your scouts find a stack of cut firewood, neatly arranged, beside a hearth that has not been used in a generation.",
  "The land here is gentle, well-watered, and oddly empty — the kind of place that should have been settled, and wasn't.",
  "Your party crosses an old battlefield. The grass grows greener on certain patches, and your captain insists everyone ride single file.",
];
