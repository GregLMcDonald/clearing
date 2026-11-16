// Québec French content. Overlays the English data in library.js / phrases.js
// by id; anything missing here falls back to English (tests check it's all here).
// Register: professional, "vous", Québec vocabulary (trousse, assoyez-vous…).
// Guidance avoids gendered agreements ("prêt", "assis") so it fits everyone.

export const FR_POSITIONS = {
  seat:   { label: "Assis",          cue: "Venez vous asseoir confortablement sur votre tapis." },
  table:  { label: "À quatre pattes", cue: "Venez à quatre pattes." },
  stand:  { label: "Debout",         cue: "Remontez debout, à l'avant de votre tapis." },
  prone:  { label: "Sur le ventre",  cue: "Allongez-vous sur le ventre." },
  supine: { label: "Sur le dos",     cue: "Allongez-vous sur le dos." },
};

export const FR_PHASES = {
  center: "Arrivée", warmup: "Réchauffement", main: "Cœur de la séance", cooldown: "Retour au calme", final: "Repos",
};

export const FR_FAMILIES = {
  seated: "Assis", table: "À quatre pattes", standing: "Debout", balance: "Équilibre", strength: "Renforcement",
  backbend: "Flexion arrière", fold: "Flexion avant", twist: "Torsion", hip: "Ouverture des hanches",
  supine: "Couché", rest: "Repos", flow: "Enchaînements",
};

export const FR_LEVELS = { 1: "Débutant", 2: "Intermédiaire" };

export const FR_FOCUSES = {
  all: "Équilibrée", hips: "Hanches", back: "Dos", shoulders: "Épaules", energize: "Énergisante", calm: "Apaisante",
};

export const FR_LINES = {
  welcome:    "Bienvenue. Commençons notre pratique ensemble.",
  release:    "Et relâchez.",
  switch:     "Maintenant, l'autre côté.",
  lastBreath: "Encore une respiration.",
  wake:       "Approfondissez doucement votre respiration. Bougez les doigts et les orteils. Lorsque vous le souhaitez, roulez sur le côté droit, et remontez lentement en position assise.",
  close:      "Merci pour votre pratique. Namasté.",
  flowOn:     "Maintenant, enchaînons. Un mouvement à chaque son de cloche.",
};

const NUMBERS = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"];
export function frHoldText(n) {
  const w = NUMBERS[n] || String(n);
  return n === 1 ? "Restez ici pendant une respiration." : `Restez ici pendant ${w} respirations.`;
}

export const FR_MUSIC = { "music.forest": "Forêt", "music.meadow": "Prairie" };

// ───────── postures ─────────
// english = French display/spoken name (the field keeps its name so the
// overlay can be merged straight onto the English pose).
export const FR_POSES = {
  "easy-seat": { english: "Posture facile",
    guide: "Assoyez-vous les jambes croisées confortablement, et déposez les mains sur vos genoux. Grandissez-vous par le sommet de la tête, et laissez vos épaules se détendre. Laissez votre respiration ralentir et s'approfondir.",
    mods: "Assoyez-vous sur une couverture pliée ou un coussin pour que vos genoux puissent reposer plus bas que vos hanches." },
  "neck-release": { english: "Étirement du cou",
    guide: "Toujours en position assise, laissez votre oreille droite descendre doucement vers l'épaule droite. Gardez l'épaule opposée détendue et lourde. Ne tirez pas; laissez le poids de la tête faire le travail.",
    mods: "Déposez légèrement la main droite sur le côté de la tête pour ajouter un peu de poids, sans jamais tirer." },
  "seated-side-bend": { english: "Flexion latérale assise",
    guide: "En position assise, le dos long, déposez la main gauche au sol à côté de vous, et tendez le bras droit vers le haut puis vers la gauche. Gardez les deux ischions bien ancrés, et respirez dans les côtes du côté droit.",
    mods: "Gardez la main levée sur votre tête si l'épaule proteste." },
  "seated-twist-easy": { english: "Torsion assise facile",
    guide: "En position assise, le dos long, placez la main gauche sur le genou droit et le bout des doigts de la main droite au sol derrière vous. Inspirez pour allonger la colonne, et expirez pour tourner doucement vers la droite. Laissez la torsion partir du ventre, pas du cou." },
  "cat-cow": { english: "Chat et vache",
    guide: "Placez les poignets sous les épaules et les genoux sous les hanches. À l'inspiration, laissez descendre le ventre et levez le regard pour la vache. À l'expiration, arrondissez le dos et rentrez le menton pour le chat. Laissez la respiration guider le mouvement.",
    mods: "Pliez votre tapis ou ajoutez une couverture sous les genoux s'ils sont sensibles." },
  "thread-needle": { english: "Enfiler l'aiguille",
    guide: "Tendez le bras droit vers le plafond, puis glissez-le sous le bras gauche, en déposant l'épaule droite et le côté de la tête sur le tapis. Gardez les hanches au-dessus des genoux, et laissez le haut du dos se détendre." },
  "balancing-table": { english: "Table en équilibre",
    guide: "Allongez le bras droit vers l'avant et la jambe gauche vers l'arrière, tous deux à la hauteur des hanches. Rentrez doucement le ventre, et gardez les hanches à niveau. Étirez-vous loin, du bout des doigts jusqu'au talon.",
    mods: "Gardez la main au sol et allongez seulement la jambe si l'équilibre est instable." },
  "childs-pose": { english: "Posture de l'enfant",
    guide: "Rapprochez les gros orteils et écartez les genoux. Descendez les hanches vers les talons et déposez le front sur le tapis, les bras allongés vers l'avant. Laissez votre dos s'élargir à chaque respiration.",
    mods: "Déposez le front sur un bloc ou sur vos poings superposés s'il ne touche pas le sol." },
  "puppy": { english: "Posture du chiot",
    guide: "Gardez les hanches au-dessus des genoux et avancez les mains. Descendez la poitrine vers le tapis, et déposez le front ou le menton. Sentez l'étirement dans les épaules et le haut du dos." },
  "downward-dog": { english: "Chien tête en bas",
    guide: "Repliez les orteils et soulevez les hanches vers le haut et l'arrière. Poussez fermement dans les mains, et pliez les genoux autant qu'il le faut pour garder la colonne longue. Laissez la tête pendre entre les bras.",
    mods: "Pédalez avec les pieds, en pliant un genou puis l'autre, pour assouplir l'arrière des cuisses." },
  "low-lunge": { english: "Fente basse",
    guide: "Avancez le pied droit entre vos mains, et déposez le genou arrière sur le tapis. Soulevez la poitrine, et posez les mains sur la cuisse avant ou tendez les bras vers le haut. Laissez les hanches descendre doucement vers l'avant, le genou avant au-dessus de la cheville.",
    mods: "Protégez le genou arrière avec une couverture pliée. Mains sur des blocs si le sol vous semble loin." },
  "ragdoll": { english: "Flexion avant debout",
    guide: "Les pieds écartés à la largeur des hanches, penchez-vous vers l'avant en pliant généreusement les genoux. Tenez vos coudes opposés et laissez pendre la tête et le cou. Balancez-vous doucement de gauche à droite si c'est agréable.",
    mods: "Remontez lentement, une vertèbre à la fois, pour éviter un étourdissement." },
  "mountain": { english: "Posture de la montagne",
    guide: "Debout, les pieds écartés à la largeur des hanches et les bras le long du corps. Écartez les orteils et sentez votre poids réparti également sur les deux pieds. Grandissez-vous par le sommet de la tête, et relâchez les épaules vers le bas." },
  "upward-salute": { english: "Salutation vers le haut",
    guide: "Debout, balayez les bras sur les côtés et jusqu'au-dessus de la tête. Gardez les épaules loin des oreilles et les côtes détendues. Étirez-vous jusqu'au bout des doigts." },
  "chair": { english: "Posture de la chaise",
    guide: "Les pieds écartés à la largeur des hanches, pliez les genoux et reculez les hanches comme pour vous asseoir sur une chaise. Tendez les bras vers le haut, le long des oreilles. Gardez le poids dans les talons, et les genoux derrière les orteils.",
    mods: "Mains au cœur plutôt qu'au-dessus de la tête si vos épaules se fatiguent." },
  "warrior-1": { english: "Guerrier un",
    guide: "Reculez le pied gauche d'environ une longueur de jambe, et tournez légèrement les orteils arrière vers l'extérieur. Pliez le genou droit au-dessus de la cheville, orientez les hanches vers l'avant du tapis, et tendez les bras au-dessus de la tête. Poussez fermement dans le bord extérieur du pied arrière.",
    mods: "Élargissez votre position sur les côtés, comme sur deux rails, pour plus de stabilité." },
  "crescent-lunge": { english: "Fente haute en croissant",
    guide: "Reculez loin le pied gauche et restez sur la plante du pied arrière. Pliez le genou droit au-dessus de la cheville et tendez les bras au-dessus de la tête. Soulevez la cuisse arrière, et rentrez doucement le bas du ventre.",
    mods: "Déposez le genou arrière au sol pour une fente basse." },
  "warrior-2": { english: "Guerrier deux",
    guide: "Écartez largement les pieds. Tournez le pied droit vers le bout du tapis, et pliez le genou droit au-dessus de la cheville. Ouvrez les bras à la hauteur des épaules, et posez doucement le regard au-delà des doigts de la main droite." },
  "reverse-warrior": { english: "Guerrier inversé",
    guide: "Les pieds écartés, tournez le pied droit vers l'extérieur et pliez le genou droit. Glissez la main gauche le long de la jambe arrière, et tendez le bras droit vers le haut et l'arrière. Gardez le genou avant plié pendant que vous allongez le côté du corps." },
  "side-angle": { english: "Angle latéral étendu",
    guide: "Les pieds écartés, tournez le pied droit vers l'extérieur et pliez le genou droit au-dessus de la cheville. Déposez l'avant-bras droit sur la cuisse droite, et tendez le bras gauche vers le haut et par-dessus l'oreille. Formez une longue ligne du talon arrière jusqu'au bout des doigts." },
  "triangle": { english: "Posture du triangle",
    guide: "Les pieds écartés, tournez le pied droit vers l'extérieur, et gardez les deux jambes tendues sans verrouiller les genoux. Étirez-vous vers l'avant au-dessus de la jambe droite, puis descendez la main droite sur le tibia ou sur un bloc, et levez le bras gauche vers le plafond. Ouvrez la poitrine sur le côté.",
    mods: "Un bloc sous la main du bas garde la colonne longue au lieu de la laisser s'affaisser vers le sol." },
  "pyramid": { english: "Posture de la pyramide",
    guide: "Reculez le pied gauche d'environ un mètre, les orteils arrière légèrement tournés vers l'extérieur et les hanches orientées vers l'avant. Allongez la colonne, puis penchez-vous au-dessus de la jambe droite, les mains sur le tibia ou sur des blocs. Gardez une légère flexion dans le genou avant." },
  "wide-fold": { english: "Flexion avant jambes écartées",
    guide: "Écartez largement les pieds, les orteils vers l'avant. Les mains sur les hanches, allongez la colonne et penchez-vous vers l'avant à partir des hanches. Posez les mains au sol sous les épaules, et laissez pendre la tête.",
    mods: "Mains sur des blocs si le sol est hors de portée. Remontez lentement, les mains sur les hanches." },
  "goddess": { english: "Posture de la déesse",
    guide: "Écartez largement les pieds et tournez les orteils vers l'extérieur. Pliez profondément les genoux, dans l'axe des orteils, et descendez les hanches vers la hauteur des genoux. Pliez les coudes en forme de cactus, paumes vers l'avant, et gardez la colonne droite." },
  "garland": { english: "Posture de la guirlande",
    guide: "Écartez les pieds un peu plus que la largeur des hanches, les orteils vers l'extérieur, et descendez les hanches en accroupissement profond. Joignez les paumes et poussez doucement les coudes contre l'intérieur des genoux. Soulevez la poitrine.",
    mods: "Assoyez-vous sur un bloc, ou roulez une couverture sous vos talons s'ils se soulèvent." },
  "tree": { english: "Posture de l'arbre",
    guide: "Transférez votre poids sur le pied gauche. Placez la plante du pied droit sur la cheville, le mollet ou l'intérieur de la cuisse gauche, mais jamais sur le genou. Joignez les paumes devant la poitrine, ou tendez-les au-dessus de la tête. Fixez le regard sur un point immobile.",
    mods: "Gardez les orteils au sol, le talon contre la cheville, comme une béquille. Un mur à proximité aide." },
  "warrior-3": { english: "Guerrier trois",
    guide: "Transférez votre poids sur le pied gauche. Penchez-vous vers l'avant à partir des hanches pendant que la jambe droite se soulève derrière vous, jusqu'à ce que votre corps forme un T. Gardez les hanches à niveau et le genou d'appui souple. Les mains peuvent rester sur les hanches ou sur des blocs.",
    mods: "Mains sur des blocs ou sur le siège d'une chaise, sous les épaules." },
  "half-moon": { english: "Demi-lune",
    guide: "Les pieds écartés, tournez le pied droit vers l'extérieur et pliez le genou droit. Posez la main droite au sol ou sur un bloc, environ trente centimètres devant le pied droit. Tendez la jambe droite pendant que la jambe gauche monte à la hauteur des hanches, et ouvrez la poitrine et le bras gauche vers le plafond.",
    mods: "Pratiquez le dos contre un mur pour sentir l'ouverture des hanches." },
  "eagle": { english: "Posture de l'aigle",
    guide: "Pliez légèrement les genoux et croisez la cuisse droite par-dessus la gauche. Enroulez le pied droit derrière le mollet gauche, ou déposez les orteils au sol. Croisez le bras gauche sous le droit, pliez les coudes et rapprochez les paumes. Descendez un peu plus et soulevez les coudes.",
    mods: "Prenez vos épaules opposées dans vos mains plutôt que d'enrouler les bras." },
  "plank": { english: "Planche",
    guide: "Reculez les pieds un à la fois pour former une longue ligne de la tête aux talons. Gardez les épaules au-dessus des poignets et le ventre doucement rentré. Déposez les genoux sur le tapis à tout moment.",
    mods: "Genoux au sol, hanches alignées avec les épaules : c'est encore la planche." },
  "side-plank": { english: "Planche latérale",
    guide: "Reculez en planche. Roulez sur le bord extérieur du pied droit et sur la main droite, et superposez le pied gauche, ou déposez le genou du bas pour plus de soutien. Soulevez les hanches, et tendez le bras gauche vers le plafond.",
    mods: "Genou du bas au sol, tibia vers l'arrière, pour une planche latérale soutenue." },
  "boat": { english: "Posture du bateau",
    guide: "Assoyez-vous les genoux pliés et les pieds au sol. Tenez l'arrière des cuisses, penchez-vous légèrement vers l'arrière avec la colonne longue, et soulevez les pieds jusqu'à ce que les tibias soient parallèles au sol. Gardez la poitrine soulevée, et tendez les bras vers l'avant lorsque vous le pouvez.",
    mods: "Gardez les orteils au sol et penchez-vous seulement vers l'arrière si le bas du dos s'arrondit." },
  "sphinx": { english: "Posture du sphinx",
    guide: "Placez les coudes sous les épaules, les avant-bras parallèles. Poussez doucement dans les avant-bras pour soulever la poitrine. Laissez les jambes se détendre, et gardez la nuque longue." },
  "cobra": { english: "Posture du cobra",
    guide: "Placez les mains sous les épaules, les coudes près du corps. Poussez le dessus des pieds dans le sol, et soulevez la poitrine avec les muscles du dos, en mettant peu de poids dans les mains. Gardez les coudes pliés et les épaules détendues." },
  "locust": { english: "Posture de la sauterelle",
    guide: "Déposez les bras le long du corps, paumes vers le bas. Soulevez la poitrine, les bras et les jambes de quelques centimètres. Étirez-vous vers l'arrière par le bout des doigts et des orteils, et gardez le regard vers le bas pour protéger la nuque.",
    mods: "Pour commencer, soulevez seulement la poitrine, ou seulement les jambes." },
  "pigeon": { english: "Posture du pigeon",
    guide: "Avancez le genou droit derrière le poignet droit, et placez le tibia droit en diagonale sur le tapis. Glissez la jambe gauche droit vers l'arrière. Gardez les hanches à niveau, et restez le buste droit sur les mains, ou penchez-vous vers l'avant sur les avant-bras.",
    mods: "Une couverture pliée sous la hanche avant garde le bassin à niveau et ménage le genou." },
  "bound-angle": { english: "Posture du papillon",
    guide: "Joignez les plantes des pieds et laissez les genoux s'ouvrir. Tenez vos chevilles ou vos pieds, et allongez la colonne. Si vous le souhaitez, penchez-vous doucement vers l'avant à partir des hanches, en gardant le dos long.",
    mods: "Des blocs ou des coussins sous les genoux permettent aux hanches de relâcher sans tension." },
  "cow-face-arms": { english: "Bras de la tête de vache",
    guide: "Le dos bien droit, levez le bras droit, pliez le coude, et laissez la main droite descendre entre les omoplates. Amenez le bras gauche derrière le dos, paume vers l'extérieur, et faites remonter les doigts vers la main droite. Gardez la tête haute et les côtes détendues.",
    mods: "Tenez une sangle ou le bas de votre chandail entre les mains si elles ne se rejoignent pas." },
  "head-to-knee": { english: "Tête au genou",
    guide: "Allongez la jambe droite devant vous et pliez le genou gauche, en plaçant la plante du pied gauche contre l'intérieur de la cuisse droite. Tournez la poitrine vers la jambe droite, grandissez-vous, puis penchez-vous vers l'avant au-dessus de la jambe tendue. Gardez ce genou plié si l'arrière de vos cuisses est raide." },
  "seated-forward-fold": { english: "Flexion avant assise",
    guide: "Allongez les deux jambes devant vous. Inspirez pour allonger la colonne, et expirez pour vous pencher vers l'avant à partir des hanches, en allant vers les tibias, les chevilles ou les pieds. Pliez les genoux autant qu'il le faut, et laissez la tête se détendre.",
    mods: "Assoyez-vous sur une couverture pliée pour que le bassin puisse basculer vers l'avant." },
  "half-lord-fishes": { english: "Demi-seigneur des poissons",
    guide: "Les jambes allongées, pliez le genou droit et posez le pied droit au sol, à l'extérieur de la cuisse gauche. Enlacez le genou droit avec le bras gauche, placez la main droite derrière vous, et grandissez-vous. À chaque expiration, tournez un peu plus vers la droite." },
  "bridge": { english: "Posture du pont",
    guide: "Pliez les genoux et posez les pieds à plat, à la largeur des hanches, près des fesses. Poussez dans les pieds et soulevez les hanches vers le plafond. Gardez les genoux pointés vers l'avant; vous pouvez joindre les mains sous vous.",
    mods: "Glissez un bloc sous le sacrum pour un pont soutenu et reposant." },
  "supported-fish": { english: "Poisson soutenu",
    guide: "Appuyez-vous sur les coudes, glissez un bloc ou une couverture roulée en travers, sous les omoplates, et allongez-vous par-dessus. Laissez les bras s'ouvrir sur les côtés, paumes vers le haut, et la tête reposer sur le tapis. Sentez la poitrine s'ouvrir à chaque respiration.",
    mods: "Posez la tête sur un coussin si le cou est tendu. Sans accessoire, allongez-vous à plat, les bras grands ouverts." },
  "figure-four": { english: "Figure quatre couchée",
    guide: "Les genoux pliés, croisez la cheville droite sur la cuisse gauche. Soulevez le pied gauche et tenez l'arrière de la cuisse gauche, en la ramenant doucement vers vous. Gardez le pied droit fléchi et les épaules détendues." },
  "knees-to-chest": { english: "Genoux à la poitrine",
    guide: "Ramenez les deux genoux vers la poitrine. Bercez-vous doucement de gauche à droite pour masser le bas du dos. Laissez les épaules et la tête lourdes sur le tapis." },
  "supine-twist": { english: "Torsion couchée",
    guide: "Ramenez le genou droit vers la poitrine, puis guidez-le de l'autre côté du corps, vers la gauche, avec la main gauche. Allongez le bras droit sur le côté et, si c'est confortable, tournez le regard vers la droite. Laissez les deux épaules lourdes.",
    mods: "Déposez le genou qui croise sur un coussin s'il ne touche pas le sol." },
  "happy-baby": { english: "Bébé heureux",
    guide: "Pliez les genoux vers les aisselles, et tenez le bord extérieur des pieds ou l'arrière des cuisses. Alignez les chevilles au-dessus des genoux, et ramenez doucement les genoux vers le bas. Laissez le bas du dos reposer sur le tapis." },
  "reclined-bound-angle": { english: "Papillon couché",
    guide: "Joignez les plantes des pieds et laissez les genoux s'ouvrir. Déposez une main sur le ventre et l'autre sur le cœur. Laissez la gravité faire le travail.",
    mods: "Des coussins sous chaque genou rendent cette posture tout à fait reposante." },
  "savasana": { english: "Posture du cadavre",
    guide: "Laissez les jambes et les bras se détendre, paumes vers le haut, et fermez les yeux. Relâchez tout effort, et laissez la respiration retrouver son rythme naturel. Reposez-vous ici.",
    mods: "Une couverture roulée sous les genoux soulage le bas du dos. Couvrez-vous; le corps se refroidit vite." },
};

// ───────── flows ─────────
// moves line up with the English moves by index. A given English cue must
// always map to the same French cue (cue clips are shared by text).
const reachUp = { show: "Salutation vers le haut", cue: "Levez les bras.", teach: "Depuis la montagne, balayez les bras sur les côtés et jusqu'au-dessus de la tête." };
const fold1   = { show: "Flexion avant debout", cue: "Penchez-vous.", teach: "Pliez-vous aux hanches et penchez-vous vers l'avant, les genoux souples." };
const halfway = { show: "Dos plat", cue: "Dos plat.", teach: "Posez les mains sur les tibias et allongez la colonne vers l'avant, comme une table." };
const fold2   = { show: "Flexion avant debout", cue: "Penchez-vous.", teach: "Penchez-vous de nouveau vers l'avant, et laissez pendre la tête." };
const riseUp  = { show: "Salutation vers le haut", cue: "Remontez.", teach: "Pliez les genoux, ouvrez les bras, et remontez jusqu'en haut." };
const heart   = { show: "Posture de la montagne", cue: "Mains au cœur.", teach: "Joignez les paumes devant le cœur." };

export const FR_FLOWS = {
  "half-sun": { english: "Demi-salutation au soleil",
    guide: "Un enchaînement doux, debout. Nous le ferons lentement une première fois, en tenant chaque forme, puis nous enchaînerons avec un mouvement à chaque son de cloche.",
    mods: "Gardez les genoux souples dans chaque flexion, et pliez-les généreusement si l'arrière de vos cuisses est raide.",
    moves: [reachUp, fold1, halfway, fold2, riseUp, heart] },
  "sun-a": { english: "Salutation au soleil A",
    guide: "L'enchaînement classique du vinyasa. Nous le ferons lentement une première fois, en tenant chaque forme, puis nous enchaînerons avec un mouvement à chaque son de cloche.",
    mods: "Descendre les genoux au sol est toujours une option, à chaque ronde. Avancez les pieds en marchant; sauter est facultatif.",
    moves: [
      reachUp, fold1, halfway,
      { show: "Planche", cue: "Reculez en planche.", teach: "Plantez les mains et reculez, un pied à la fois, en planche." },
      { show: "Planche", cue: "Allongez.", teach: "Les épaules au-dessus des poignets, le ventre doucement rentré. Une longue ligne de la tête aux talons." },
      { show: "Descente", cue: "Genoux au sol. Descendez lentement.", teach: "Déposez les genoux sur le tapis, serrez les coudes près du corps, et descendez lentement la poitrine jusqu'au sol.",
        l2: { cue: "Chaturanga.", teach: "Serrez les coudes près du corps et descendez à mi-chemin, en gardant une longue ligne de la tête aux talons. Déposez les genoux à tout moment." } },
      { show: "Posture du cobra", cue: "Cobra.", teach: "Dépliez les orteils, appuyez légèrement dans les mains, et soulevez la poitrine avec les muscles du dos." },
      { show: "Chien tête en bas", cue: "Chien tête en bas.", teach: "Repliez les orteils et soulevez les hanches vers le haut et l'arrière." },
      { show: "Chien tête en bas", cue: "Pédalez avec les talons.", teach: "Restez ici. Pédalez avec les talons, en pliant un genou, puis l'autre." },
      { show: "Dos plat", cue: "Avancez. Dos plat.", teach: "Avancez les pieds jusqu'aux mains en marchant, ou en sautant si vous le souhaitez, et allongez la colonne, le dos plat." },
      fold2, riseUp, heart,
    ] },
  "warrior-flow": { english: "Enchaînement des guerriers",
    guide: "Trois formes de guerrier enchaînées. Nous l'apprendrons lentement du premier côté, puis nous enchaînerons avec un mouvement à chaque son de cloche.",
    mods: "Gardez le genou avant au-dessus de la cheville en tout temps. Raccourcissez votre position si vos hanches ou vos genoux protestent.",
    setup: { cue: "Guerrier deux.", teach: "Écartez largement les pieds, tournez le pied droit vers l'extérieur, et pliez le genou droit au-dessus de la cheville. Ouvrez grand les bras. Voici le guerrier deux." },
    moves: [
      { show: "Guerrier inversé", cue: "Guerrier inversé.", teach: "Glissez la main gauche le long de la jambe arrière, et tendez le bras droit vers le haut et l'arrière. Gardez le genou avant plié." },
      { show: "Angle latéral étendu", cue: "Angle latéral.", teach: "Déposez l'avant-bras droit sur la cuisse droite, et tendez le bras gauche vers le haut et par-dessus l'oreille." },
      { show: "Guerrier inversé", cue: "Guerrier inversé.", teach: "Remontez en guerrier inversé." },
      { show: "Guerrier deux", cue: "Guerrier deux.", teach: "Les bras grands ouverts, revenez en guerrier deux." },
    ] },
};
