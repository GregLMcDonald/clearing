// Pose library — pure data, no DOM. Imported by the app AND by
// scripts/build-audio.mjs, so every word here is also what gets voiced.
//
// Field reference
//   id        stable slug; part of audio clip ids, never rename casually
//   english   common English name (shown big, spoken first)
//   sanskrit  transliterated Sanskrit name without diacritics, or null
//   say       optional TTS respelling of the Sanskrit name if the voice
//             mispronounces it (display always uses `sanskrit`)
//   phase     where the generator may place it: center | warmup | main | cooldown | final
//   family    library grouping (see FAMILIES)
//   base      body position the guidance starts from (see POSITIONS); the
//             player announces a position change when consecutive poses differ
//   seq       natural place in a class arc; poses are ordered by seq within a phase
//   level     1 = beginner, 2 = intermediate
//   sided     true → held on one side, then the other (guide describes the first side)
//   breaths   default hold in breaths (per side); the generator scales it
//   hold      "breaths" (default) or "time" (savasana: held in seconds, no breath cues)
//   priority  true → the generator includes it first when its phase has room
//   focus     tags from FOCUSES (set in FOCUS_TAGS below): a session with that
//             focus picks these first and gives them the longer holds
//   guide     spoken + displayed guidance: how to come in, one or two key cues
//   mods      displayed only (not spoken): props and easier options

export const POSITIONS = {
  seat:   { label: "Seated",           cue: "Come to a comfortable seat on your mat." },
  table:  { label: "Hands and knees",  cue: "Come onto your hands and knees." },
  stand:  { label: "Standing",         cue: "Make your way up to standing at the top of your mat." },
  prone:  { label: "On your belly",    cue: "Lower down to lie on your belly." },
  supine: { label: "On your back",     cue: "Lie down on your back." },
};

export const PHASES = [
  { id: "center",   label: "Arrive" },
  { id: "warmup",   label: "Warm up" },
  { id: "main",     label: "Build" },
  { id: "cooldown", label: "Cool down" },
  { id: "final",    label: "Rest" },
];

export const FAMILIES = {
  seated:   "Seated",
  table:    "Hands and knees",
  standing: "Standing",
  balance:  "Balance",
  strength: "Strength",
  backbend: "Backbend",
  fold:     "Forward fold",
  twist:    "Twist",
  hip:      "Hip opener",
  supine:   "Lying down",
  rest:     "Rest",
  flow:     "Flows",
};

export const LEVELS = { 1: "Beginner", 2: "Intermediate" };

// Optional session focus. Body areas pull matching postures in first;
// energize and calm also reshape the arc (see session.js).
export const FOCUSES = {
  all:       "All-round",
  hips:      "Hips",
  back:      "Back",
  shoulders: "Shoulders",
  energize:  "Energizing",
  calm:      "Calming",
};

// Which focus each posture or flow serves. Kept in one table so the tagging
// can be read and balanced at a glance.
const FOCUS_TAGS = {
  "easy-seat":            ["calm"],
  "neck-release":         ["shoulders", "calm"],
  "seated-side-bend":     ["back", "shoulders"],
  "seated-twist-easy":    ["back"],
  "cat-cow":              ["back"],
  "thread-needle":        ["shoulders", "back"],
  "balancing-table":      ["back", "energize"],
  "childs-pose":          ["back", "hips", "calm"],
  "puppy":                ["shoulders", "back"],
  "downward-dog":         ["shoulders", "energize"],
  "low-lunge":            ["hips"],
  "ragdoll":              ["back", "calm"],
  "mountain":             [],
  "upward-salute":        ["shoulders", "energize"],
  "chair":                ["energize"],
  "warrior-1":            ["hips", "energize"],
  "crescent-lunge":       ["hips", "energize"],
  "warrior-2":            ["hips", "energize"],
  "reverse-warrior":      ["energize"],
  "side-angle":           ["hips"],
  "triangle":             ["hips"],
  "pyramid":              ["hips"],
  "wide-fold":            ["hips", "calm"],
  "goddess":              ["hips", "energize"],
  "garland":              ["hips"],
  "tree":                 ["calm"],
  "warrior-3":            ["energize"],
  "half-moon":            ["hips", "energize"],
  "eagle":                ["shoulders"],
  "plank":                ["shoulders", "energize"],
  "side-plank":           ["shoulders", "energize"],
  "boat":                 ["energize"],
  "sphinx":               ["back", "calm"],
  "cobra":                ["back"],
  "locust":               ["back", "energize"],
  "pigeon":               ["hips"],
  "bound-angle":          ["hips", "calm"],
  "cow-face-arms":        ["shoulders"],
  "head-to-knee":         ["back", "calm"],
  "seated-forward-fold":  ["back", "calm"],
  "half-lord-fishes":     ["back"],
  "bridge":               ["back", "energize"],
  "supported-fish":       ["shoulders", "calm"],
  "figure-four":          ["hips"],
  "knees-to-chest":       ["back", "calm"],
  "supine-twist":         ["back", "calm"],
  "happy-baby":           ["hips", "calm"],
  "reclined-bound-angle": ["hips", "calm"],
  "savasana":             ["calm"],
  "half-sun":             ["energize"],
  "sun-a":                ["energize", "shoulders"],
  "warrior-flow":         ["hips", "energize"],
};

function pose(id, english, sanskrit, o) {
  return {
    id, english, sanskrit,
    say: o.say || null,
    phase: o.phase,
    family: o.family,
    base: o.base,
    seq: o.seq,
    level: o.level || 1,
    sided: !!o.sided,
    breaths: o.breaths || 5,
    hold: o.hold || "breaths",
    priority: !!o.priority,
    focus: FOCUS_TAGS[id] || [],
    guide: o.guide,
    mods: o.mods || "",
  };
}

export const POSES = [
  // ───────── Arrive ─────────
  pose("easy-seat", "Easy pose", "Sukhasana", {
    phase: "center", family: "seated", base: "seat", seq: 10, breaths: 6,
    guide: "Sit with your legs crossed comfortably and rest your hands on your knees. Lengthen up through the crown of your head, and let your shoulders soften. Let your breath slow down and deepen.",
    mods: "Sit on a folded blanket or cushion so your knees can rest below your hips.",
  }),

  // ───────── Warm up ─────────
  pose("neck-release", "Seated neck release", null, {
    phase: "warmup", family: "seated", base: "seat", seq: 11, sided: true, breaths: 3,
    guide: "Stay seated. Let your right ear fall gently toward your right shoulder. Keep the opposite shoulder soft and heavy. Don't pull; let the weight of your head do the work.",
    mods: "Rest your right hand lightly on the side of your head for a little more weight, never a tug.",
  }),
  pose("seated-side-bend", "Seated side bend", "Parsva Sukhasana", {
    phase: "warmup", family: "seated", base: "seat", seq: 12, sided: true, breaths: 3,
    guide: "Sitting tall, place your left hand on the floor beside you, and reach your right arm up and over toward the left. Keep both sit bones heavy, and breathe into the right side of your ribs.",
    mods: "Keep the lifted hand on your head if your shoulder complains.",
  }),
  pose("seated-twist-easy", "Easy seated twist", "Parivrtta Sukhasana", {
    phase: "warmup", family: "twist", base: "seat", seq: 14, sided: true, breaths: 3,
    guide: "Sitting tall, bring your left hand to your right knee and your right fingertips to the floor behind you. Inhale to lengthen your spine, and exhale to turn gently to the right. Let the twist start from your belly, not your neck.",
  }),
  pose("cat-cow", "Cat and cow", "Marjaryasana Bitilasana", {
    phase: "warmup", family: "table", base: "table", seq: 20, breaths: 6, priority: true,
    guide: "Bring your wrists under your shoulders and your knees under your hips. As you inhale, drop your belly and lift your gaze for cow. As you exhale, round your spine and tuck your chin for cat. Let the breath lead the movement.",
    mods: "Fold your mat or add a blanket under your knees if they are sensitive.",
  }),
  pose("thread-needle", "Thread the needle", "Parsva Balasana", {
    phase: "warmup", family: "twist", base: "table", seq: 22, sided: true, breaths: 4,
    guide: "Reach your right arm up toward the ceiling, then thread it under your left arm, resting your right shoulder and the side of your head on the mat. Keep your hips over your knees, and let your upper back soften.",
  }),
  pose("balancing-table", "Balancing table", "Dandayamana Bharmanasana", {
    phase: "warmup", family: "strength", base: "table", seq: 24, sided: true, breaths: 4,
    guide: "Reach your right arm forward and your left leg back, both at the height of your hips. Draw your belly gently in, and keep your hips level. Reach long through your fingertips and your heel.",
    mods: "Keep the hand on the mat and extend only the leg if balance is shaky.",
  }),
  pose("childs-pose", "Child's pose", "Balasana", {
    phase: "warmup", family: "rest", base: "table", seq: 26, breaths: 6,
    guide: "Bring your big toes together and widen your knees. Sink your hips back toward your heels and rest your forehead on the mat, with your arms reaching forward. Let your back broaden with each breath.",
    mods: "Rest your forehead on a block or stacked fists if it doesn't reach the floor.",
  }),
  pose("puppy", "Puppy pose", "Uttana Shishosana", {
    phase: "warmup", family: "backbend", base: "table", seq: 27, breaths: 5,
    guide: "Keep your hips over your knees and walk your hands forward. Lower your chest toward the mat, and rest your forehead or chin down. Feel the stretch through your shoulders and upper back.",
  }),
  pose("downward-dog", "Downward-facing dog", "Adho Mukha Svanasana", {
    phase: "warmup", family: "fold", base: "table", seq: 30, breaths: 5, priority: true,
    guide: "Tuck your toes and lift your hips up and back. Press firmly through your hands, and bend your knees as much as you need to keep your spine long. Let your head hang between your arms.",
    mods: "Pedal your feet, bending one knee then the other, to ease into the hamstrings.",
  }),
  pose("low-lunge", "Low lunge", "Anjaneyasana", {
    phase: "warmup", family: "hip", base: "table", seq: 32, sided: true, breaths: 4,
    guide: "Step your right foot forward between your hands, and lower your back knee to the mat. Lift your chest, and rest your hands on your front thigh or reach your arms up. Sink your hips gently forward, with your front knee over your ankle.",
    mods: "Pad your back knee with a folded blanket. Hands on blocks if the floor feels far.",
  }),
  pose("ragdoll", "Standing forward fold", "Uttanasana", {
    phase: "warmup", family: "fold", base: "stand", seq: 36, breaths: 5,
    guide: "With your feet hip-width apart, fold forward with a generous bend in your knees. Hold opposite elbows and let your head and neck hang. Sway gently side to side if that feels good.",
    mods: "Roll up slowly, one vertebra at a time, to avoid a head rush.",
  }),

  // ───────── Build ─────────
  pose("mountain", "Mountain pose", "Tadasana", {
    phase: "main", family: "standing", base: "stand", seq: 40, breaths: 4, priority: true,
    guide: "Stand with your feet hip-width apart and your arms by your sides. Spread your toes and feel your weight evenly across both feet. Lengthen up through the crown of your head, and relax your shoulders down.",
  }),
  pose("upward-salute", "Upward salute", "Urdhva Hastasana", {
    phase: "main", family: "standing", base: "stand", seq: 41, breaths: 4,
    guide: "From standing, sweep your arms out to the sides and up overhead. Keep your shoulders relaxed away from your ears and your ribs soft. Reach up through your fingertips.",
  }),
  pose("chair", "Chair pose", "Utkatasana", {
    phase: "main", family: "strength", base: "stand", seq: 42, breaths: 5,
    guide: "With your feet hip-width apart, bend your knees and sit your hips back as if into a chair. Reach your arms up alongside your ears. Keep your weight in your heels, and your knees behind your toes.",
    mods: "Hands at your heart instead of overhead if your shoulders tire.",
  }),
  pose("warrior-1", "Warrior one", "Virabhadrasana I", {
    say: "Virabhadrasana One",
    phase: "main", family: "standing", base: "stand", seq: 44, sided: true, breaths: 5,
    guide: "Step your left foot back about a leg's length, and turn your back toes out slightly. Bend your right knee over your ankle, turn your hips toward the front of the mat, and reach your arms overhead. Press firmly through the outer edge of your back foot.",
    mods: "Widen your stance side to side, like standing on two train tracks, for more stability.",
  }),
  pose("crescent-lunge", "High crescent lunge", "Ashta Chandrasana", {
    phase: "main", family: "standing", base: "stand", seq: 45, level: 2, sided: true, breaths: 4,
    guide: "Step your left foot far back and stay up on the ball of the back foot. Bend your right knee over your ankle and reach your arms overhead. Lift through your back thigh, and draw your lower belly gently in.",
    mods: "Lower the back knee to the mat for a low lunge.",
  }),
  pose("warrior-2", "Warrior two", "Virabhadrasana II", {
    say: "Virabhadrasana Two",
    phase: "main", family: "standing", base: "stand", seq: 46, sided: true, breaths: 5, priority: true,
    guide: "Step your feet wide apart. Turn your right foot out to face the short end of the mat, and bend your right knee over your ankle. Reach your arms out at shoulder height, and gaze softly past your right fingertips.",
  }),
  pose("reverse-warrior", "Reverse warrior", "Viparita Virabhadrasana", {
    phase: "main", family: "standing", base: "stand", seq: 47, sided: true, breaths: 4,
    guide: "Step your feet wide, turn your right foot out, and bend your right knee. Slide your left hand down your back leg, and reach your right arm up and back. Keep the front knee bent as you lengthen through your side body.",
  }),
  pose("side-angle", "Extended side angle", "Utthita Parsvakonasana", {
    phase: "main", family: "standing", base: "stand", seq: 48, sided: true, breaths: 5,
    guide: "Step your feet wide, turn your right foot out, and bend your right knee over the ankle. Rest your right forearm on your right thigh, and reach your left arm up and over your ear. Make one long line from your back heel to your fingertips.",
  }),
  pose("triangle", "Triangle pose", "Utthita Trikonasana", {
    phase: "main", family: "standing", base: "stand", seq: 50, sided: true, breaths: 5,
    guide: "Step your feet wide, turn your right foot out, and keep both legs straight without locking your knees. Reach forward over your right leg, then lower your right hand to your shin or a block, and lift your left arm to the ceiling. Open your chest to the side.",
    mods: "A block under the lower hand keeps the spine long instead of collapsing toward the floor.",
  }),
  pose("pyramid", "Pyramid pose", "Parsvottanasana", {
    phase: "main", family: "fold", base: "stand", seq: 52, sided: true, breaths: 4,
    guide: "Step your left foot back about three feet, with your back toes turned out slightly and your hips facing forward. Lengthen your spine, then fold over your right leg with your hands on your shin or on blocks. Keep a soft bend in your front knee.",
  }),
  pose("wide-fold", "Wide-legged forward fold", "Prasarita Padottanasana", {
    phase: "main", family: "fold", base: "stand", seq: 54, breaths: 5,
    guide: "Step your feet wide apart, toes pointing forward. With your hands on your hips, lengthen your spine and fold forward from your hips. Bring your hands to the floor under your shoulders, and let your head hang.",
    mods: "Hands on blocks if the floor is out of reach. Come up slowly, with your hands on your hips.",
  }),
  pose("goddess", "Goddess pose", "Utkata Konasana", {
    phase: "main", family: "strength", base: "stand", seq: 56, breaths: 5,
    guide: "Step your feet wide and turn your toes out. Bend your knees deeply, tracking them over your toes, and lower your hips toward knee height. Bend your elbows into a cactus shape, palms forward, and keep your spine tall.",
  }),
  pose("garland", "Garland pose", "Malasana", {
    phase: "main", family: "hip", base: "stand", seq: 58, breaths: 5,
    guide: "Step your feet a little wider than your hips, toes turned out, and lower your hips into a deep squat. Bring your palms together and press your elbows gently against your inner knees. Lift your chest.",
    mods: "Sit on a block, or roll a blanket under your heels if they lift.",
  }),
  pose("tree", "Tree pose", "Vrksasana", {
    phase: "main", family: "balance", base: "stand", seq: 60, sided: true, breaths: 5, priority: true,
    guide: "Shift your weight onto your left foot. Place the sole of your right foot on your left ankle, calf, or inner thigh, but never on the knee. Bring your palms together at your chest, or reach them overhead. Rest your gaze on one still point.",
    mods: "Keep your toes on the floor, heel against the ankle, like a kickstand. A wall nearby helps.",
  }),
  pose("warrior-3", "Warrior three", "Virabhadrasana III", {
    say: "Virabhadrasana Three",
    phase: "main", family: "balance", base: "stand", seq: 62, level: 2, sided: true, breaths: 4,
    guide: "Shift your weight onto your left foot. Hinge forward from your hips as your right leg lifts behind you, until your body forms a T. Keep your hips level and your standing knee soft. Your hands can rest on your hips or on blocks.",
    mods: "Hands on blocks or a chair seat under your shoulders.",
  }),
  pose("half-moon", "Half moon", "Ardha Chandrasana", {
    phase: "main", family: "balance", base: "stand", seq: 64, level: 2, sided: true, breaths: 4,
    guide: "From a wide stance, turn your right foot out and bend your right knee. Bring your right hand to the floor or a block, about a foot in front of your right foot. Straighten your right leg as your left leg lifts to hip height, and open your chest and left arm toward the ceiling.",
    mods: "Practise with your back against a wall to feel the open hips.",
  }),
  pose("eagle", "Eagle pose", "Garudasana", {
    phase: "main", family: "balance", base: "stand", seq: 66, level: 2, sided: true, breaths: 4,
    guide: "Bend your knees slightly and cross your right thigh over your left. Wrap your right foot behind your left calf, or rest your toes on the floor. Cross your left arm under your right, bend your elbows, and bring your palms toward each other. Sit a little lower and lift your elbows.",
    mods: "Hug opposite shoulders instead of wrapping the arms.",
  }),
  pose("plank", "Plank pose", "Phalakasana", {
    phase: "main", family: "strength", base: "table", seq: 70, breaths: 4,
    guide: "Step your feet back one at a time into a long line from head to heels. Keep your shoulders over your wrists and your belly gently drawn in. Lower your knees to the mat at any time.",
    mods: "Knees down, hips in line with shoulders, is still plank.",
  }),
  pose("side-plank", "Side plank", "Vasisthasana", {
    phase: "main", family: "strength", base: "table", seq: 72, level: 2, sided: true, breaths: 3,
    guide: "Step back to plank. Roll onto the outer edge of your right foot and your right hand, and stack your left foot on top, or lower your bottom knee for support. Lift your hips, and reach your left arm toward the ceiling.",
    mods: "Bottom knee down, shin angled back, for a supported side plank.",
  }),
  pose("boat", "Boat pose", "Navasana", {
    phase: "main", family: "strength", base: "seat", seq: 76, level: 2, breaths: 4,
    guide: "Sit with your knees bent and your feet on the floor. Hold the backs of your thighs, lean back slightly with a long spine, and lift your feet until your shins are parallel to the floor. Keep your chest lifted, and reach your arms forward when you're ready.",
    mods: "Keep your toes on the floor and just lean back if your lower back rounds.",
  }),

  // ───────── Cool down ─────────
  pose("sphinx", "Sphinx pose", "Salamba Bhujangasana", {
    phase: "cooldown", family: "backbend", base: "prone", seq: 80, breaths: 5,
    guide: "Bring your elbows under your shoulders, with your forearms parallel. Press gently into your forearms to lift your chest. Let your legs relax, and keep your neck long.",
  }),
  pose("cobra", "Cobra pose", "Bhujangasana", {
    phase: "cooldown", family: "backbend", base: "prone", seq: 82, breaths: 4,
    guide: "Place your hands under your shoulders, with your elbows close to your sides. Press the tops of your feet into the floor, and lift your chest using your back muscles, with only a little weight in your hands. Keep your elbows bent and your shoulders soft.",
  }),
  pose("locust", "Locust pose", "Salabhasana", {
    phase: "cooldown", family: "backbend", base: "prone", seq: 84, level: 2, breaths: 4,
    guide: "Rest your arms alongside you, palms down. Lift your chest, arms, and legs a few inches from the floor. Reach back through your fingertips and toes, and keep your gaze down to protect your neck.",
    mods: "Lift only the chest, or only the legs, to start.",
  }),
  pose("pigeon", "Pigeon pose", "Eka Pada Rajakapotasana", {
    phase: "cooldown", family: "hip", base: "table", seq: 88, level: 2, sided: true, breaths: 6,
    say: "Eka Pada Raja Kapotasana",
    guide: "Bring your right knee forward behind your right wrist, and angle your right shin across the mat. Slide your left leg straight back. Keep your hips level, and either stay upright on your hands or fold forward onto your forearms.",
    mods: "A folded blanket under the front hip keeps the pelvis level and the knee happy.",
  }),
  pose("bound-angle", "Bound angle pose", "Baddha Konasana", {
    phase: "cooldown", family: "hip", base: "seat", seq: 92, breaths: 6,
    guide: "Bring the soles of your feet together and let your knees fall open. Hold your ankles or feet, and lengthen your spine. If you like, hinge forward gently from your hips, keeping your back long.",
    mods: "Blocks or cushions under the knees let the hips release without strain.",
  }),
  pose("cow-face-arms", "Cow face arms", "Gomukhasana", {
    phase: "cooldown", family: "seated", base: "seat", seq: 93, sided: true, breaths: 4,
    guide: "Sitting tall, reach your right arm up, bend the elbow, and let your right hand drop between your shoulder blades. Reach your left arm behind your back, palm facing out, and walk your fingers up toward your right hand. Keep your head lifted and your ribs soft.",
    mods: "Hold a strap or the hem of your shirt between your hands if they don't meet.",
  }),
  pose("head-to-knee", "Head-to-knee pose", "Janu Sirsasana", {
    phase: "cooldown", family: "fold", base: "seat", seq: 94, sided: true, breaths: 5,
    guide: "Extend your right leg forward and bend your left knee, placing the sole of your left foot against your inner right thigh. Turn your chest toward your right leg, lengthen up, then fold forward over the straight leg. Keep a bend in that knee if your hamstrings are tight.",
  }),
  pose("seated-forward-fold", "Seated forward fold", "Paschimottanasana", {
    phase: "cooldown", family: "fold", base: "seat", seq: 96, breaths: 6,
    guide: "Extend both legs in front of you. Inhale to lengthen your spine, and exhale to hinge forward from your hips, reaching for your shins, ankles, or feet. Bend your knees as much as you need, and let your head relax.",
    mods: "Sit on a folded blanket so your pelvis can tip forward.",
  }),
  pose("half-lord-fishes", "Half lord of the fishes", "Ardha Matsyendrasana", {
    phase: "cooldown", family: "twist", base: "seat", seq: 98, sided: true, breaths: 4,
    guide: "With your legs extended, bend your right knee and place your right foot on the floor outside your left thigh. Hug your right knee with your left arm, place your right hand behind you, and sit tall. With each exhale, turn a little further to the right.",
  }),
  pose("bridge", "Bridge pose", "Setu Bandha Sarvangasana", {
    phase: "cooldown", family: "backbend", base: "supine", seq: 100, breaths: 5, priority: true,
    guide: "Bend your knees and place your feet flat, hip-width apart, close to your hips. Press into your feet and lift your hips toward the ceiling. Keep your knees pointing forward, and you can clasp your hands underneath you.",
    mods: "Slide a block under your sacrum for a supported, restful bridge.",
  }),
  pose("supported-fish", "Supported fish", "Matsyasana", {
    phase: "cooldown", family: "backbend", base: "supine", seq: 101, breaths: 6,
    guide: "Come up onto your elbows, slide a block or a rolled blanket crosswise under your shoulder blades, and lie back over it. Let your arms rest open at your sides, palms up, and let your head rest on the mat. Feel your chest open with each breath.",
    mods: "Rest your head on a cushion if your neck feels strained. Without a prop, lie flat with your arms open wide.",
  }),
  pose("figure-four", "Reclined figure four", "Sucirandhrasana", {
    phase: "cooldown", family: "hip", base: "supine", seq: 102, sided: true, breaths: 5,
    guide: "With your knees bent, cross your right ankle over your left thigh. Lift your left foot and hold behind your left thigh, drawing it gently toward you. Keep your right foot flexed and your shoulders relaxed.",
  }),
  pose("knees-to-chest", "Knees to chest", "Apanasana", {
    phase: "cooldown", family: "supine", base: "supine", seq: 104, breaths: 5,
    guide: "Hug both knees toward your chest. Rock gently from side to side to massage your lower back. Let your shoulders and head stay heavy on the mat.",
  }),
  pose("supine-twist", "Supine twist", "Supta Matsyendrasana", {
    phase: "cooldown", family: "twist", base: "supine", seq: 106, sided: true, breaths: 6, priority: true,
    guide: "Hug your right knee into your chest, then guide it across your body to the left with your left hand. Stretch your right arm out to the side, and if it's comfortable, turn your gaze to the right. Let both shoulders stay heavy.",
    mods: "Rest the crossing knee on a cushion if it doesn't reach the floor.",
  }),
  pose("happy-baby", "Happy baby", "Ananda Balasana", {
    phase: "cooldown", family: "hip", base: "supine", seq: 108, breaths: 5,
    guide: "Bend your knees toward your armpits, and hold the outer edges of your feet or the backs of your thighs. Stack your ankles over your knees, and gently draw your knees down. Let your lower back rest on the mat.",
  }),
  pose("reclined-bound-angle", "Reclined bound angle", "Supta Baddha Konasana", {
    phase: "cooldown", family: "supine", base: "supine", seq: 110, breaths: 6,
    guide: "Bring the soles of your feet together and let your knees fall open. Rest one hand on your belly and one on your heart. Let gravity do the work.",
    mods: "Cushions under each knee make this fully restful.",
  }),

  // ───────── Rest ─────────
  pose("savasana", "Corpse pose", "Savasana", {
    phase: "final", family: "rest", base: "supine", seq: 120, hold: "time",
    say: "Shavasana",
    guide: "Let your legs and arms relax, palms facing up, and close your eyes. Release any effort, and let your breath return to its natural rhythm. Rest here.",
    mods: "A rolled blanket under the knees eases the lower back. Cover up; you cool down quickly.",
  }),
];

// ───────── Flows ─────────
// A flow links movement to breath (vinyasa style). It shares a pose's fields
// (english, sanskrit, phase, family, base, seq, level, sided, guide, mods) and
// adds:
//   kind     "flow"
//   rounds   default number of rounds (per side for sided flows)
//   setup    optional { cue, teach }: getting into the starting shape (said each side)
//   replaces pose ids a session shouldn't also contain when this flow is in it
//   moves    [{ breath, show, cue, teach, n?, l2? }]
//              breath  "in" | "out": one inhale / exhale for this movement
//                      "stay": hold the shape for n full breaths
//              show    name of the shape, shown on screen
//              cue     very short line spoken on the move while flowing (1–2 s)
//              teach   fuller line spoken on the first, slow round
//              l2      { cue, teach } replacing both at intermediate level
//
// Round one (when guidance is read aloud) is taught: each move's teach line,
// then one full breath in the shape. Later rounds flow: one movement per
// chime, with only the short cue.

function flow(id, english, sanskrit, o) {
  return { ...pose(id, english, sanskrit, { ...o, family: "flow" }), kind: "flow",
    rounds: o.rounds || 2, setup: o.setup || null, replaces: o.replaces || [], moves: o.moves };
}
const m = (breath, show, cue, teach, extra = {}) => ({ breath, show, cue, teach, ...extra });

export const FLOWS = [
  flow("half-sun", "Half sun salutation", "Ardha Surya Namaskar", {
    phase: "main", base: "stand", seq: 39,
    guide: "A gentle standing flow. We'll move through it slowly once, holding each shape, then flow with one movement for each chime.",
    mods: "Keep your knees soft in every fold, and bend them generously if your hamstrings are tight.",
    replaces: ["mountain", "upward-salute"],
    moves: [
      m("in",  "Upward salute", "Reach up.", "From mountain, sweep your arms out to the sides and up overhead."),
      m("out", "Standing forward fold", "Fold.", "Hinge at your hips and fold forward, with soft knees."),
      m("in",  "Halfway lift", "Halfway lift.", "Bring your hands to your shins and lengthen your spine forward, like a tabletop."),
      m("out", "Standing forward fold", "Fold.", "Fold forward again, and let your head hang."),
      m("in",  "Upward salute", "Rise up.", "Bend your knees, reach your arms out, and rise all the way up."),
      m("out", "Mountain pose", "Hands to heart.", "Bring your palms together at your heart."),
    ],
  }),
  flow("sun-a", "Sun salutation A", "Surya Namaskar A", {
    say: "Surya Namaskar A",
    phase: "main", base: "stand", seq: 39,
    guide: "The classic vinyasa sequence. We'll move through it slowly once, holding each shape, then flow with one movement for each chime.",
    mods: "Lowering with your knees down is always an option, on any round. Walk your feet forward; hopping is optional.",
    replaces: ["mountain", "upward-salute", "plank", "cobra", "downward-dog"],
    moves: [
      m("in",  "Upward salute", "Reach up.", "From mountain, sweep your arms out to the sides and up overhead."),
      m("out", "Standing forward fold", "Fold.", "Hinge at your hips and fold forward, with soft knees."),
      m("in",  "Halfway lift", "Halfway lift.", "Bring your hands to your shins and lengthen your spine forward, like a tabletop."),
      m("out", "Plank pose", "Step back to plank.", "Plant your hands and step back, one foot at a time, into plank."),
      m("in",  "Plank pose", "Lengthen.", "Shoulders over wrists, belly gently in. One long line from head to heels."),
      m("out", "Lowering down", "Knees down. Lower slowly.", "Bring your knees to the mat, hug your elbows in, and lower your chest slowly to the floor.", {
        l2: { cue: "Chaturanga.", teach: "Hug your elbows in and lower halfway down, keeping one long line from head to heels. Drop your knees any time." },
      }),
      m("in",  "Cobra pose", "Cobra.", "Untuck your toes, press lightly into your hands, and lift your chest with your back muscles."),
      m("out", "Downward-facing dog", "Downward dog.", "Tuck your toes and lift your hips up and back."),
      m("stay", "Downward-facing dog", "Pedal your heels.", "Stay here. Pedal your heels, bending one knee, then the other.", { n: 3 }),
      m("in",  "Halfway lift", "Walk forward. Halfway lift.", "Walk your feet up to your hands, or hop if you like, and lift halfway with a long spine."),
      m("out", "Standing forward fold", "Fold.", "Fold forward again, and let your head hang."),
      m("in",  "Upward salute", "Rise up.", "Bend your knees, reach your arms out, and rise all the way up."),
      m("out", "Mountain pose", "Hands to heart.", "Bring your palms together at your heart."),
    ],
  }),
  flow("warrior-flow", "Warrior flow", null, {
    phase: "main", base: "stand", seq: 46, sided: true,
    guide: "Three warrior shapes linked together. We'll learn it slowly on the first side, then flow with one movement for each chime.",
    mods: "Keep the front knee over the ankle the whole time. Shorten your stance if your hips or knees complain.",
    replaces: ["warrior-2", "reverse-warrior", "side-angle"],
    setup: { cue: "Warrior two.", teach: "Step your feet wide, turn your right foot out, and bend your right knee over your ankle. Reach your arms out wide. This is warrior two." },
    moves: [
      m("in",  "Reverse warrior", "Reverse warrior.", "Slide your left hand down your back leg, and reach your right arm up and back. Keep your front knee bent."),
      m("out", "Extended side angle", "Side angle.", "Bring your right forearm to your right thigh, and reach your left arm up and over your ear."),
      m("in",  "Reverse warrior", "Reverse warrior.", "Sweep back up into reverse warrior."),
      m("out", "Warrior two", "Warrior two.", "Arms wide, back to warrior two."),
    ],
  }),
];

// Moves with the level variant applied.
export function flowMoves(f, level) {
  return f.moves.map((mv) => (level === 2 || level === "intermediate") && mv.l2 ? { ...mv, ...mv.l2 } : mv);
}

const BY_ID = new Map([...POSES, ...FLOWS].map((p) => [p.id, p]));
export function poseById(id) { return BY_ID.get(id) || null; }
export const isFlow = (p) => !!p && p.kind === "flow";
