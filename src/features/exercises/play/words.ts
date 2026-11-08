/** Secret words for Hangman: things from Adam's mountain and from this course. */
export const HANGMAN_WORDS = `
goat summit climb valley meadow pebble boulder glacier canyon ridge cliff trail snowy breeze thunder cloud pine
cheese grass clover horns hooves llama python loop string garden pocket rocket wizard jacket puzzle planet
number random module object vector matrix tensor neuron layer model gradient keyboard window button banana
cactus dragon castle forest island jungle ocean river spider turtle walrus zebra yellow purple orange silver
`
  .split(/\s+/)
  .filter(Boolean)

/** Wordle's words: the answers, and the only guesses it accepts. Common five-letter words. */
export const WORDLE_WORDS = `
about above actor adult after again agent agree ahead alarm album alert alike alive allow alone along alter
among angel anger angle angry apple apply arena argue arise array aside asset audio audit avoid award aware
badly baker basic beach began begin being below bench birth black blade blame blank blast blend blind block
blood board boost booth bound brain brand brave bread break bring broad brown brush build built buyer cabin
cable carry catch cause chain chair chalk charm chart chase cheap check chess chest chief child chose civil
claim class clean clear click climb clock close cloud coach coast could count court cover craft crane crash
cream crime cross crowd crown curve cycle daily dance dated dealt death delay depth dirty doubt dozen draft
drama drawn dream dress drink drive eager early earth eight elite empty enemy enjoy enter entry equal error
event every exact exist extra faith false fault fiber field fifth fifty fight final first flame flash fleet
floor fluid focus force forth forty forum found frame fresh front fruit funny ghost giant given glass globe
goats grace grade grain grand grant grass great green group guard guess guest guide habit happy heart heavy
hello horse hotel house human humor ideal image index inner input issue joint judge juice knife label large
laser later laugh layer learn least leave legal lemon level light limit lived local logic loose lower lucky
lunch magic major maker march match maybe mayor meant medal metal might minor mixed model money month moral
motor mount mouse mouth movie music nerve never night noise north noted novel nurse ocean offer often order
other ought outer owner paint panel paper party peace phase phone photo piano piece pilot pitch place plain
plane plant plate point pound power press price pride prime print prior prize proof proud prove queen quick
quiet quite radio raise range rapid ratio reach ready refer relax reply right river robot rough round route
royal rural salad scale scene scope score sense serve seven shade shake shape share sharp sheep shelf shell
shift shine shirt shock shoot short shown sight silly since skill sleep slide small smart smile smoke snake
solid solve sorry sound south space spare speak speed spend spent spice split spoke sport staff stage stake
stand start state steam steel steep stick still stock stone stood store storm story strip stuck study stuff
style sugar suite sunny super sweet table taken taste teach teeth thank theme there thick thing think third
those three threw throw tight timer tired title toast today topic total touch tough tower track trade train
treat trend trial tribe trick tried truck truly trust truth twice under union unity until upper upset urban
usual valid value video virus visit vital vocal voice waste watch water wheel where which while white whole
whose woman world worry worse worst worth would wound write wrong wrote yield young youth zebra
`
  .split(/\s+/)
  .filter(Boolean)

export const randomItem = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]
