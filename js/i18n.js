// UI strings (English + Québec French) and the current language.
// Static markup: data-i18n="key" (text), data-i18n-aria="key" (aria-label and
// title), data-i18n-ph="key" (placeholder). applyStatic() fills them in.
// Dynamic text: t("key", { vars }).
// French typography follows Québec usage: a non-breaking space before ":" and "%".

const S = {
  "nav.library":        ["Pose library", "Bibliothèque de postures"],
  "nav.language":       ["Language", "Langue"],
  "nav.settings":       ["Settings", "Paramètres"],
  "close":              ["Close", "Fermer"],

  "home.title":         ["Practice.", "Pratique."],
  "home.lede":          ["Pick a length. You'll get a gentle arc: arrive, warm up, build, cool down, rest.",
                         "Choisissez une durée. Vous obtiendrez un parcours en douceur : arrivée, réchauffement, cœur de la séance, retour au calme, repos."],
  "home.length":        ["Length", "Durée"],
  "home.lengthAria":    ["Session length", "Durée de la séance"],
  "home.level":         ["Level", "Niveau"],
  "home.style":         ["Style", "Style"],
  "level.beginner":     ["Beginner", "Débutant"],
  "level.intermediate": ["Intermediate", "Intermédiaire"],
  "style.steady":       ["Steady", "Posé"],
  "style.flow":         ["Flow", "Fluide"],
  "style.hint.steady":  ["Come into each posture and hold it still for a few breaths.",
                         "Entrez dans chaque posture et tenez-la immobile pendant quelques respirations."],
  "style.hint.flow":    ["Adds sun salutations and a warrior flow, moving with one movement for each chime.",
                         "Ajoute des salutations au soleil et un enchaînement des guerriers, à raison d'un mouvement par son de cloche."],
  "home.focus":         ["Focus", "Orientation"],
  "focus.hint.all":     ["A balanced mix for the whole body.", "Un mélange équilibré pour tout le corps."],
  "focus.hint.hips":    ["More hip openers and lunges, with longer holds.", "Plus d'ouvertures des hanches et de fentes, tenues plus longtemps."],
  "focus.hint.back":    ["More for the spine: cat and cow, gentle backbends, twists and folds.",
                         "Plus de mouvements pour la colonne : chat et vache, flexions arrière douces, torsions et flexions avant."],
  "focus.hint.shoulders": ["More shoulder, chest and upper-back openers.", "Plus d'ouvertures des épaules, de la poitrine et du haut du dos."],
  "focus.hint.energize": ["More time standing and building strength, and a shorter rest.",
                         "Plus de temps debout et en renforcement, et un repos plus court."],
  "focus.hint.calm":    ["A longer cool down and a longer rest at the end.", "Un retour au calme plus long et un repos final prolongé."],
  "home.build":         ["Build my session", "Créer ma séance"],
  "home.last":          ["Your last proposed session", "Votre dernière séance proposée"],
  "home.lastPractice":  ["Last practice: {date}, {dur}", "Dernière pratique : {date}, {dur}"],
  "home.endedEarly":    [" (ended early)", " (interrompue)"],
  "streak.today":       ["Practiced today", "Pratique faite aujourd'hui"],
  "streak.todayN":      ["Practiced today · {n}-day streak", "Pratique faite aujourd'hui · {n} jours d'affilée"],
  "streak.yesterday":   ["Practiced yesterday", "Pratique faite hier"],
  "streak.keep":        ["{n}-day streak · practice today to keep it", "{n} jours d'affilée · pratiquez aujourd'hui pour continuer"],
  "streak.log":         ["Your practice log", "Votre journal de pratique"],

  "audio.device":       ["Using your device's voice", "Voix de votre appareil"],
  "audio.deviceSub":    ["No audio pack has been built yet, so guidance uses built-in speech and simple tones.",
                         "Aucune trousse audio n'a encore été créée : les consignes utilisent la synthèse vocale de l'appareil et des sons simples."],
  "audio.downloading":  ["Downloading audio pack {pct}%", "Téléchargement de la trousse audio {pct} %"],
  "audio.ready":        ["Audio pack ready", "Trousse audio prête"],
  "audio.readySub":     ["{mb}, works offline", "{mb}, fonctionne hors ligne"],
  "audio.missing":      ["Audio pack not downloaded", "Trousse audio non téléchargée"],
  "audio.missingSub":   ["Connect to download it. Until then your device's voice is used.",
                         "Connectez-vous pour la télécharger. D'ici là, la voix de votre appareil est utilisée."],
  "audio.error":        ["Audio download failed", "Échec du téléchargement audio"],
  "audio.download":     ["Download", "Télécharger"],

  "pack.label":         ["Audio pack", "Trousse audio"],
  "pack.none":          ["No audio pack is published with this build. Voice uses your device's speech, and bells, breath chimes and music are synthesized.",
                         "Aucune trousse audio n'est publiée avec cette version. La voix utilise la synthèse vocale de l'appareil, et les cloches, les sons de respiration et la musique sont synthétisés."],
  "pack.info":          ["{n} clips, {mb}, built {when}.", "{n} extraits, {mb}, créée le {when}."],
  "pack.isReady":       ["Downloaded to this device.", "Téléchargée sur cet appareil."],
  "pack.isDownloading": ["Downloading {pct}%…", "Téléchargement {pct} %…"],
  "pack.notYet":        ["Not downloaded yet.", "Pas encore téléchargée."],
  "pack.check":         ["Check for updates", "Vérifier les mises à jour"],
  "pack.checkAgain":    ["Check again", "Vérifier de nouveau"],
  "pack.downloadNow":   ["Download now", "Télécharger maintenant"],
  "pack.unknownDate":   ["unknown date", "date inconnue"],
  "toast.packNone":     ["No audio pack published", "Aucune trousse audio publiée"],
  "toast.upToDate":     ["Audio pack is up to date", "La trousse audio est à jour"],
  "toast.updated":      ["Audio pack updated", "Trousse audio mise à jour"],
  "toast.newMix":       ["New mix ready", "Nouvelle version prête"],

  "preview.title":      ["{n}-minute session", "Séance de {n} minutes"],
  "preview.back":       ["Practice", "Pratique"],
  "preview.showGuide":  ["Show guidance text", "Afficher le texte des consignes"],
  "preview.newMix":     ["New mix", "Nouvelle version"],
  "preview.begin":      ["Begin", "Commencer"],
  "preview.edited":     ["Edited", "Modifiée"],
  "edit.less":          ["Shorter hold", "Tenue plus courte"],
  "edit.more":          ["Longer hold", "Tenue plus longue"],
  "edit.swap":          ["Swap", "Remplacer"],
  "edit.remove":        ["Remove", "Retirer"],
  "edit.removed":       ["Removed {name}", "Retrait : {name}"],
  "edit.swapped":       ["Swapped in {name}", "Remplacement : {name}"],
  "edit.undo":          ["Undo", "Annuler"],
  "swap.title":         ["Swap posture", "Remplacer la posture"],
  "swap.instead":       ["Instead of {name}", "À la place de : {name}"],
  "summary.about":      ["About {dur}", "Environ {dur}"],
  "hold.eachSide":      ["each side", "de chaque côté"],
  "hold.rest":          ["rest", "repos"],
  "prep.ready":         ["Audio ready", "Audio prêt"],
  "prep.device":        ["Device voice", "Voix de l'appareil"],
  "prep.downloading":   ["Downloading audio {pct}%", "Téléchargement audio {pct} %"],
  "prep.preparing":     ["Preparing audio {pct}%", "Préparation audio {pct} %"],
  "prep.partial":       ["Audio {ready}/{total}, rest uses device voice", "Audio {ready}/{total}, le reste avec la voix de l'appareil"],

  "unit.mb":            ["MB", "Mo"],
  "unit.breath":        ["breath", "respiration"],
  "unit.breaths":       ["breaths", "respirations"],
  "unit.posture":       ["posture", "posture"],
  "unit.postures":      ["postures", "postures"],
  "unit.flow":          ["flow", "enchaînement"],
  "unit.flows":         ["flows", "enchaînements"],
  "unit.round":         ["round", "ronde"],
  "unit.rounds":        ["rounds", "rondes"],
  "unit.move":          ["move", "mouvement"],
  "unit.moves":         ["moves", "mouvements"],
  "unit.day":           ["day", "jour"],
  "unit.days":          ["days", "jours"],
  "unit.entry":         ["log entry", "entrée"],
  "unit.entries":       ["log entries", "entrées"],

  "player.end":         ["End session", "Terminer la séance"],
  "player.remaining":   ["Time remaining", "Temps restant"],
  "player.closing":     ["Closing", "Conclusion"],
  "player.count":       ["{a} of {b}", "{a} de {b}"],
  "player.next":        ["Next: {name}", "Suivant : {name}"],
  "player.nextClosing": ["Next: closing", "Suivant : conclusion"],
  "player.prev":        ["Previous posture", "Posture précédente"],
  "player.nextPose":    ["Next posture", "Posture suivante"],
  "player.pause":       ["Pause", "Pause"],
  "player.resume":      ["Resume", "Reprendre"],
  "player.guidance":    ["Guidance", "Consignes"],
  "player.paused":      ["Paused", "En pause"],
  "side.first":         ["First side", "Premier côté"],
  "side.other":         ["Other side", "Autre côté"],
  "breath.in":          ["Breathe in", "Inspirez"],
  "breath.out":         ["Breathe out", "Expirez"],
  "breath.round":       ["Round {a} of {b}", "Ronde {a} de {b}"],
  "stage.intro":        ["Arrive", "Arrivée"],
  "stage.enter":        ["Move in", "Placez-vous"],
  "stage.switch":       ["Switch", "Changez"],
  "stage.release":      ["Release", "Relâchez"],
  "stage.rest":         ["Rest", "Repos"],
  "stage.outro":        ["Return", "Retour"],

  "done.completed":     ["You practiced for {dur}. Take a moment before you get up.",
                         "Vous avez pratiqué pendant {dur}. Prenez un moment avant de vous relever."],
  "done.early":         ["You practiced for {dur}. Every bit counts.", "Vous avez pratiqué pendant {dur}. Chaque minute compte."],
  "done.again":         ["Repeat this session", "Refaire cette séance"],
  "done.home":          ["Back to practice", "Retour à la pratique"],
  "done.streak":        ["{n} days in a row.", "{n} jours d'affilée."],

  "log.title":          ["Log.", "Journal."],
  "log.empty":          ["Nothing logged yet. Sessions longer than a minute appear here.",
                         "Rien dans le journal pour l'instant. Les séances de plus d'une minute s'affichent ici."],
  "log.current":        ["Current streak", "Série en cours"],
  "log.longest":        ["Longest streak", "Plus longue série"],
  "log.sessions":       ["Sessions", "Séances"],
  "log.total":          ["Time practiced", "Temps de pratique"],
  "log.weeks":          ["Last {n} weeks", "{n} dernières semaines"],
  "log.calAria":        ["Practice over the last {n} weeks: {d}", "Pratique des {n} dernières semaines : {d}"],
  "log.cellTitle":      ["{date}: {dur}", "{date} : {dur}"],
  "log.session":        ["Session", "Séance"],
  "log.endedEarly":     ["ended early", "interrompue"],
  "log.delete":         ["Delete entry", "Supprimer l'entrée"],
  "log.deleteConfirm":  ["Delete this entry from your log?", "Supprimer cette entrée de votre journal?"],

  "library.title":      ["Library.", "Bibliothèque."],
  "library.search":     ["Search English or Sanskrit", "Rechercher en français ou en sanskrit"],
  "library.all":        ["All", "Toutes"],
  "library.empty":      ["No postures match.", "Aucune posture ne correspond."],
  "library.eachSide":   ["Each side", "De chaque côté"],
  "pose.starts":        ["Starts: {pos}", "Départ : {pos}"],
  "pose.timedRest":     ["Timed rest", "Repos chronométré"],
  "pose.defaultBreaths":["{n} breaths by default", "{n} respirations par défaut"],
  "moves.start":        ["Start", "Départ"],
  "moves.in":           ["In", "Insp."],
  "moves.out":          ["Out", "Exp."],
  "tip":                ["Tip", "Conseil"],

  "settings.title":     ["Settings", "Paramètres"],
  "settings.pace":      ["Breath pace", "Rythme respiratoire"],
  "settings.inhale":    ["Inhale", "Inspiration"],
  "settings.exhale":    ["Exhale", "Expiration"],
  "settings.inhaleLess":["Shorter inhale", "Inspiration plus courte"],
  "settings.inhaleMore":["Longer inhale", "Inspiration plus longue"],
  "settings.exhaleLess":["Shorter exhale", "Expiration plus courte"],
  "settings.exhaleMore":["Longer exhale", "Expiration plus longue"],
  "settings.paceHint":  ["One breath in and out. Hold lengths are counted in these breaths.",
                         "Une inspiration et une expiration. La durée des postures se compte en respirations."],
  "settings.guidance":  ["Guidance", "Consignes"],
  "settings.readGuide": ["Read guidance aloud", "Lire les consignes à voix haute"],
  "settings.readGuideHint": ["Shown on screen as it's spoken. When off, you hear only the posture's name and hold, and the full guidance stays in the Guidance panel.",
                         "Affichées à l'écran pendant la lecture. Si l'option est désactivée, vous entendez seulement le nom de la posture et sa durée; les consignes complètes restent dans le panneau Consignes."],
  "settings.music":     ["Music", "Musique"],
  "settings.musicOff":  ["Off", "Aucune"],
  "settings.volume":    ["Volume", "Volume"],
  "settings.volVoice":  ["Voice", "Voix"],
  "settings.volMusic":  ["Music", "Musique"],
  "settings.volSfx":    ["Chimes and bells", "Sons de cloche"],
  "settings.theme":     ["Theme", "Thème"],
  "theme.auto":         ["Auto", "Auto"],
  "theme.meadow":       ["Meadow", "Prairie"],
  "theme.forest":       ["Forest", "Forêt"],

  "data.label":         ["Your data", "Vos données"],
  "data.export":        ["Export", "Exporter"],
  "data.import":        ["Import", "Importer"],
  "data.hint":          ["Your log and settings as a JSON file. Importing adds the file's log entries to yours and takes its settings.",
                         "Votre journal et vos paramètres dans un fichier JSON. L'importation ajoute les entrées du fichier à votre journal et reprend ses paramètres."],
  "data.exported":      ["Exported", "Exportation terminée"],
  "data.imported":      ["Imported: {what}", "Importation : {what}"],
  "data.badFile":       ["That isn't a Clearing backup", "Ce fichier n'est pas une sauvegarde de Clearing"],
  "drive.label":        ["Google Drive backup", "Sauvegarde Google Drive"],
  "drive.placeholder":  ["OAuth client ID (…apps.googleusercontent.com)", "ID client OAuth (…apps.googleusercontent.com)"],
  "drive.hint":         ["Optional. Paste your own Google OAuth client ID (see the README); it stays on this device. Until you do, Clearing never contacts Google.",
                         "Facultatif. Collez votre propre ID client OAuth Google (voir le README); il reste sur cet appareil. D'ici là, Clearing ne communique jamais avec Google."],
  "drive.connect":      ["Connect Google Drive", "Connecter Google Drive"],
  "drive.backup":       ["Back up now", "Sauvegarder"],
  "drive.restore":      ["Restore", "Restaurer"],
  "drive.disconnect":   ["Disconnect", "Déconnecter"],
  "drive.notSetUp":     ["Not set up", "Non configurée"],
  "drive.notConnected": ["Not connected", "Non connectée"],
  "drive.connecting":   ["Connecting…", "Connexion…"],
  "drive.connected":    ["Connected", "Connectée"],
  "drive.syncing":      ["Backing up…", "Sauvegarde…"],
  "drive.lastSynced":   ["Last backed up {when}", "Dernière sauvegarde : {when}"],
  "drive.loading":      ["Google sign-in is still loading. Try again in a moment.", "La connexion Google se charge encore. Réessayez dans un instant."],
  "drive.loadFailed":   ["Couldn't reach Google", "Impossible de joindre Google"],
  "drive.connectFailed":["Couldn't connect to Drive", "Connexion à Drive impossible"],
  "drive.backedUp":     ["Backed up to Drive", "Sauvegarde dans Drive terminée"],
  "drive.backupFailed": ["Backup failed", "Échec de la sauvegarde"],
  "drive.offline":      ["You're offline", "Vous êtes hors ligne"],
  "drive.noBackup":     ["No backup found on Drive", "Aucune sauvegarde trouvée dans Drive"],
  "drive.restored":     ["Restored from Drive", "Restauration terminée"],
  "drive.restoreFailed":["Couldn't restore from Drive", "Restauration impossible"],
  "drive.restoreConfirm": ["Replace this device's log and settings with the Drive backup?",
                         "Remplacer le journal et les paramètres de cet appareil par la sauvegarde Drive?"],
  "drive.newerConfirm": ["Drive has a newer backup ({when}). Restore it? This replaces this device's log and settings.",
                         "Drive contient une sauvegarde plus récente ({when}). La restaurer? Le journal et les paramètres de cet appareil seront remplacés."],
  "drive.disconnected": ["Disconnected from Drive", "Drive déconnecté"],

  "lang.title":         ["Language", "Langue"],
  "lang.hint":          ["Changes the app and the voice. Your current session is rebuilt to keep its length.",
                         "Change la langue de l'application et de la voix. La séance en cours est reconstruite pour garder sa durée."],
};

let lang = "en";
export const getLang = () => lang;
export function setLang(l) { lang = l === "fr" ? "fr" : "en"; }
export const locale = () => (lang === "fr" ? "fr-CA" : undefined);

export function t(key, vars) {
  const pair = S[key];
  const s = pair ? pair[lang === "fr" ? 1 : 0] ?? pair[0] : key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "")) : s;
}
export function plural(n, unit) { return `${n} ${t(`unit.${unit}${n === 1 ? "" : "s"}`)}`; }
export const allKeys = () => Object.keys(S);
export const isTranslated = (key) => !!S[key] && typeof S[key][1] === "string" && S[key][1].length > 0;

// Fill static markup. Elements that also hold an icon keep it: only their
// text node is replaced.
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((node) => setOwnText(node, t(node.dataset.i18n)));
  root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    const v = t(node.dataset.i18nAria);
    node.setAttribute("aria-label", v);
    if (node.hasAttribute("title")) node.setAttribute("title", v);
  });
  root.querySelectorAll("[data-i18n-ph]").forEach((node) => node.setAttribute("placeholder", t(node.dataset.i18nPh)));
  document.documentElement.lang = lang === "fr" ? "fr-CA" : "en";
  document.documentElement.style.setProperty("--tip-label", JSON.stringify(`${t("tip")}  `));
}
function setOwnText(node, text) {
  if (!node.children.length) { node.textContent = text; return; }
  const textNodes = [...node.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim());
  if (textNodes.length) { textNodes[0].nodeValue = text; textNodes.slice(1).forEach((n) => n.remove()); }
  else node.append(text);
}
