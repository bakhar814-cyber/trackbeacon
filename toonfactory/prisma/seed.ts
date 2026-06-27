// ToonFactory demo seed.
//
// Populates a rich, realistic dataset so the dashboard looks alive immediately:
// one series, its cast + world, eight episodes in various states of production,
// generated assets/scenes/thumbnails, analytics + channel growth, a cost ledger,
// logs, optimization recommendations and settings.
//
// Idempotent: every run clears the existing data (in FK-safe order) and rebuilds.
// All money is stored in micro-USD (integer 1e-6 USD) where the field is
// `costMicroUsd`. Timestamps are relative to "now" via daysAgo()/daysFromNow().
//
//   npm run seed        (or)        npx prisma db seed

import { PrismaClient, Prisma, type Episode } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Time helpers — keep everything relative to the moment the seed runs.
// ---------------------------------------------------------------------------
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);
const usd = (dollars: number) => Math.round(dollars * 1_000_000); // → micro-USD

// Small deterministic helper so generated numbers feel organic but stable-ish.
function jitter(base: number, spread: number): number {
  return Math.round(base + (Math.random() - 0.5) * 2 * spread);
}

async function clearAll() {
  // Delete in dependency order. Most relations cascade, but we are explicit so
  // the seed works even if the schema's cascade rules change.
  await prisma.analyticsSnapshot.deleteMany();
  await prisma.thumbnail.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.job.deleteMany();
  await prisma.canonFact.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.episode.deleteMany();
  await prisma.location.deleteMany();
  await prisma.character.deleteMany();
  await prisma.series.deleteMany();
  await prisma.channelStat.deleteMany();
  await prisma.costEvent.deleteMany();
  await prisma.logEntry.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.setting.deleteMany();
}

async function main() {
  console.log("🌱 Seeding ToonFactory demo data…");
  await clearAll();

  // =========================================================================
  // SERIES
  // =========================================================================
  const series = await prisma.series.create({
    data: {
      title: "The Adventures of Pip & Bramble",
      logline:
        "A curious little fox kit and his gentle bear-cub best friend explore the Whispering Woods, " +
        "turning everyday mishaps into warm lessons about kindness, courage and curiosity.",
      targetAge: "3-8",
      worldRules: {
        tone: "gentle, wholesome, reassuring",
        targetAge: "3-8",
        violence: "none",
        scariness: "none — conflicts are gentle and always resolved kindly",
        lessonsPerEpisode: 1,
        themes: [
          "kindness",
          "sharing",
          "curiosity",
          "patience",
          "honesty",
          "friendship",
          "facing small fears",
        ],
        dos: [
          "model emotional vocabulary",
          "show problem-solving through teamwork",
          "end every episode on a hopeful, cozy note",
        ],
        donts: [
          "no peril, weapons, or jump-scares",
          "no sarcasm or mean-spirited humor",
          "no brand references or junk-food promotion",
        ],
        pacing: "calm, with a single clear problem-and-resolution arc",
        recurringFormat:
          "cold-open hook → discovery → small problem → gentle lesson → cozy resolution → seed of next adventure",
      },
      artStyle: {
        style: "soft 2D storybook",
        rendering: "flat shading with subtle paper-grain texture",
        outlines: "thick, friendly, hand-drawn ink outlines",
        palette: "warm, sun-dappled pastels",
        paletteHex: ["#F6C453", "#E07A5F", "#81B29A", "#3D405B", "#F2CC8F", "#A8DADC"],
        lighting: "golden-hour glow, soft ambient occlusion",
        aspectRatio: "16:9",
        negative: "no photorealism, no harsh shadows, no neon, no horror elements",
        referenceMood: "Winnie-the-Pooh meets modern Pixar warmth",
      },
    },
  });

  // =========================================================================
  // CHARACTERS
  // =========================================================================
  const pip = await prisma.character.create({
    data: {
      seriesId: series.id,
      name: "Pip",
      role: "protagonist",
      age: "young (curious kit)",
      appearance: {
        species: "fox kit",
        fur: "warm ginger-orange with a cream chest and tail-tip",
        eyes: "large, bright amber",
        build: "small, springy, oversized fluffy tail",
        palette: { primary: "#E8772E", secondary: "#FBE9D0", accent: "#FFFFFF", eyes: "#FFB347" },
        features: "perky triangular ears, expressive eyebrows, tiny black nose",
      },
      clothing: { top: "leaf-green explorer vest", accessory: "tiny brass compass on a cord" },
      personality: {
        traits: ["curious", "brave", "impulsive", "warm-hearted"],
        catchphrase: "Let's find out!",
        flaw: "leaps before looking",
        growth: "learning to pause and think things through",
      },
      voiceProfile: { provider: "elevenlabs", voiceId: "pip_brightkit_v1", pitch: 1.25, speed: 1.05 },
      designToken:
        "Pip the fox kit, warm ginger-orange fur, cream chest, amber eyes, leaf-green explorer vest, brass compass, soft 2D storybook style, thick friendly outlines",
      refImageUrl: "https://cdn.toonfactory.dev/refs/pip-turnaround.png",
      arc: [
        { episode: 1, beat: "Acts on impulse and gets the friends briefly lost." },
        { episode: 3, beat: "Learns to count to five before deciding." },
        { episode: 6, beat: "Pauses to make a careful plan that saves the day." },
      ],
    },
  });

  const bramble = await prisma.character.create({
    data: {
      seriesId: series.id,
      name: "Bramble",
      role: "protagonist",
      age: "young (gentle cub)",
      appearance: {
        species: "bear cub",
        fur: "soft cocoa-brown with a lighter muzzle and round tummy",
        eyes: "gentle dark chocolate",
        build: "round, huggable, a little clumsy",
        palette: { primary: "#7B4B2A", secondary: "#C8956C", accent: "#FBE9D0", eyes: "#3A2A1A" },
        features: "rounded ears, soft cheeks, slow blink",
      },
      clothing: { top: "knitted mustard scarf", accessory: "satchel of honey-oat snacks" },
      personality: {
        traits: ["gentle", "thoughtful", "shy", "loyal"],
        catchphrase: "Maybe we should think first?",
        flaw: "worries and hesitates",
        growth: "finding small everyday courage",
      },
      voiceProfile: { provider: "elevenlabs", voiceId: "bramble_softcub_v1", pitch: 0.85, speed: 0.95 },
      designToken:
        "Bramble the bear cub, soft cocoa-brown fur, lighter muzzle, round tummy, mustard knitted scarf, honey satchel, soft 2D storybook style, thick friendly outlines",
      refImageUrl: "https://cdn.toonfactory.dev/refs/bramble-turnaround.png",
      arc: [
        { episode: 2, beat: "Speaks up for the first time to help a friend." },
        { episode: 4, beat: "Faces the dark Old Oak Library and finds it cozy." },
        { episode: 7, beat: "Leads the rescue while Pip follows his plan." },
      ],
    },
  });

  const olive = await prisma.character.create({
    data: {
      seriesId: series.id,
      name: "Olive the Owl",
      role: "supporting",
      age: "elder (wise mentor)",
      appearance: {
        species: "barn owl",
        fur: "cream-and-tawny feathers with a heart-shaped face",
        eyes: "warm honey, half-moon spectacles",
        build: "small, tidy, perched and patient",
        palette: { primary: "#D9C2A3", secondary: "#9C6B3F", accent: "#FFFFFF", eyes: "#C68A2E" },
        features: "tiny round spectacles, tufted brow",
      },
      clothing: { accessory: "a string of glowing reading-lantern berries" },
      personality: {
        traits: ["wise", "patient", "kind", "playful-clever"],
        catchphrase: "Whooo wants to learn something new?",
        role: "the friends' gentle guide and librarian",
      },
      voiceProfile: { provider: "elevenlabs", voiceId: "olive_wiseowl_v1", pitch: 0.95, speed: 0.9 },
      designToken:
        "Olive the barn owl, cream-and-tawny feathers, heart-shaped face, tiny round spectacles, glowing berry lantern, soft 2D storybook style, thick friendly outlines",
      refImageUrl: "https://cdn.toonfactory.dev/refs/olive-turnaround.png",
      arc: [{ episode: 4, beat: "Reveals the Old Oak Library's secret reading-nook." }],
    },
  });

  const hazel = await prisma.character.create({
    data: {
      seriesId: series.id,
      name: "Hazel the Hedgehog",
      role: "supporting",
      age: "young (Pip & Bramble's friend)",
      appearance: {
        species: "hedgehog",
        fur: "chestnut quills, peach face, freckles",
        eyes: "bright hazel-green",
        build: "tiny, bouncy, rolls into a ball when shy",
        palette: { primary: "#8A5A2B", secondary: "#F2C6A0", accent: "#A3C586", eyes: "#7FA650" },
        features: "soft quills, a single daisy tucked behind her ear",
      },
      clothing: { accessory: "a daisy-chain crown" },
      personality: {
        traits: ["energetic", "creative", "generous", "a little messy"],
        catchphrase: "Ta-daa!",
        growth: "learning to share the spotlight",
      },
      voiceProfile: { provider: "elevenlabs", voiceId: "hazel_bouncy_v1", pitch: 1.3, speed: 1.1 },
      designToken:
        "Hazel the hedgehog, chestnut quills, peach freckled face, daisy crown, soft 2D storybook style, thick friendly outlines",
      refImageUrl: "https://cdn.toonfactory.dev/refs/hazel-turnaround.png",
      arc: [{ episode: 5, beat: "Shares her invention so everyone can play together." }],
    },
  });

  const rusty = await prisma.character.create({
    data: {
      seriesId: series.id,
      name: "Rusty the Robin",
      role: "supporting",
      age: "young (messenger)",
      appearance: {
        species: "robin",
        fur: "slate-grey wings, bright tangerine breast",
        eyes: "shiny ink-black",
        build: "small, quick, always mid-flutter",
        palette: { primary: "#6B7280", secondary: "#F07F3C", accent: "#FFFFFF", eyes: "#111111" },
        features: "perky tail, a tiny mail-pouch",
      },
      clothing: { accessory: "a postal mail-pouch made of a folded leaf" },
      personality: {
        traits: ["chatty", "speedy", "well-meaning", "forgetful"],
        catchphrase: "Special delivery!",
        growth: "learning to slow down and listen",
      },
      voiceProfile: { provider: "elevenlabs", voiceId: "rusty_chirp_v1", pitch: 1.4, speed: 1.2 },
      designToken:
        "Rusty the robin, slate-grey wings, tangerine breast, tiny leaf mail-pouch, soft 2D storybook style, thick friendly outlines",
      refImageUrl: "https://cdn.toonfactory.dev/refs/rusty-turnaround.png",
      arc: [{ episode: 6, beat: "Delivers the message that brings everyone together." }],
    },
  });

  const characters = [pip, bramble, olive, hazel, rusty];

  // =========================================================================
  // LOCATIONS
  // =========================================================================
  const locWoods = await prisma.location.create({
    data: {
      seriesId: series.id,
      name: "Whispering Woods",
      description:
        "The cozy heart of the series: a sun-dappled forest of friendly oaks where every leaf seems to whisper a secret.",
      visualSpec: {
        palette: ["#81B29A", "#F6C453", "#3D405B"],
        timeOfDay: "perpetual golden hour",
        details: ["dappled light beams", "floating dandelion seeds", "moss-soft paths"],
        mood: "warm, safe, gently magical",
      },
      refImageUrl: "https://cdn.toonfactory.dev/refs/whispering-woods.png",
    },
  });
  const locMeadow = await prisma.location.create({
    data: {
      seriesId: series.id,
      name: "Sunny Meadow",
      description: "A wide rolling field of wildflowers where the friends picnic, fly kites and play.",
      visualSpec: {
        palette: ["#F2CC8F", "#A8DADC", "#81B29A"],
        timeOfDay: "bright midday",
        details: ["wildflower patches", "puffy clouds", "a single crooked picnic tree"],
        mood: "open, joyful, breezy",
      },
      refImageUrl: "https://cdn.toonfactory.dev/refs/sunny-meadow.png",
    },
  });
  const locCreek = await prisma.location.create({
    data: {
      seriesId: series.id,
      name: "Crystal Creek",
      description: "A clear, gentle stream with stepping stones, perfect for splashing and pebble-skipping.",
      visualSpec: {
        palette: ["#A8DADC", "#81B29A", "#FFFFFF"],
        timeOfDay: "cool morning",
        details: ["sparkling water", "smooth stepping stones", "dragonflies"],
        mood: "refreshing, calm, curious",
      },
      refImageUrl: "https://cdn.toonfactory.dev/refs/crystal-creek.png",
    },
  });
  const locLibrary = await prisma.location.create({
    data: {
      seriesId: series.id,
      name: "Old Oak Library",
      description:
        "Inside the hollow of the most ancient oak, Olive keeps a spiral of cozy reading-nooks lit by berry lanterns.",
      visualSpec: {
        palette: ["#9C6B3F", "#D9C2A3", "#F6C453"],
        timeOfDay: "warm lantern-lit interior",
        details: ["spiral wooden stairs", "stacked picture books", "glowing berry lanterns"],
        mood: "snug, hushed, wonder-filled",
      },
      refImageUrl: "https://cdn.toonfactory.dev/refs/old-oak-library.png",
    },
  });
  const locDen = await prisma.location.create({
    data: {
      seriesId: series.id,
      name: "Bramble's Den",
      description: "Bramble's snug burrow home: a round door, a patchwork quilt, and a always-warm honey pot.",
      visualSpec: {
        palette: ["#7B4B2A", "#C8956C", "#F2CC8F"],
        timeOfDay: "soft evening",
        details: ["round wooden door", "patchwork quilts", "honey pot on a little stove"],
        mood: "homey, safe, comforting",
      },
      refImageUrl: "https://cdn.toonfactory.dev/refs/brambles-den.png",
    },
  });

  // =========================================================================
  // RELATIONSHIPS
  // =========================================================================
  await prisma.relationship.createMany({
    data: [
      {
        seriesId: series.id,
        aId: pip.id,
        bId: bramble.id,
        kind: "best-friend",
        status: "inseparable",
        notes: "The core duo. Pip's daring balances Bramble's caution.",
      },
      {
        seriesId: series.id,
        aId: olive.id,
        bId: pip.id,
        kind: "mentor",
        status: "warm",
        notes: "Olive guides Pip's curiosity toward patience.",
      },
      {
        seriesId: series.id,
        aId: olive.id,
        bId: bramble.id,
        kind: "mentor",
        status: "warm",
        notes: "Olive gently encourages Bramble's courage.",
      },
      {
        seriesId: series.id,
        aId: hazel.id,
        bId: pip.id,
        kind: "friend",
        status: "playful",
        notes: "Hazel and Pip spark each other's wild ideas.",
      },
      {
        seriesId: series.id,
        aId: rusty.id,
        bId: hazel.id,
        kind: "friend",
        status: "chatty",
        notes: "Rusty carries Hazel's invitations around the woods.",
      },
      {
        seriesId: series.id,
        aId: bramble.id,
        bId: hazel.id,
        kind: "friend",
        status: "gentle",
        notes: "Bramble keeps Hazel's messy crafts organized.",
      },
    ],
  });

  // =========================================================================
  // CANON FACTS (continuity timeline)
  // =========================================================================
  await prisma.canonFact.createMany({
    data: [
      { seriesId: series.id, category: "rule", summary: "The woods stay forever in golden hour.", detail: "Time of day never changes in Whispering Woods; this keeps the palette consistent across episodes." },
      { seriesId: series.id, category: "item", summary: "Pip owns a tiny brass compass.", detail: "Gift introduced in episode 1; reused as a recurring prop for navigation beats." },
      { seriesId: series.id, category: "item", summary: "Bramble always carries a honey-oat snack satchel.", detail: "Source of comfort and frequent sharing moments." },
      { seriesId: series.id, category: "relationship", summary: "Pip and Bramble are best friends.", detail: "Established episode 1; their dynamic anchors every story." },
      { seriesId: series.id, category: "event", summary: "Ep1: the friends got briefly lost and found their way home using the compass.", detail: "First lesson: pausing to think helps you find the path." },
      { seriesId: series.id, category: "reveal", summary: "Ep2: Bramble can be brave when a friend needs help.", detail: "He spoke up to rescue a stuck duckling at Crystal Creek." },
      { seriesId: series.id, category: "event", summary: "Ep3: Pip learns to count to five before deciding.", detail: "His new habit; referenced in later episodes as 'Pip's pause'." },
      { seriesId: series.id, category: "reveal", summary: "Ep4: The Old Oak Library has a secret spiral reading-nook.", detail: "Revealed by Olive; becomes a recurring location." },
      { seriesId: series.id, category: "item", summary: "Hazel builds a pebble-powered kite.", detail: "Introduced episode 5; her signature invention." },
      { seriesId: series.id, category: "relationship", summary: "Olive is the friends' mentor and librarian.", detail: "Recurring guide who poses gentle questions instead of giving answers." },
      { seriesId: series.id, category: "event", summary: "Ep6: Rusty's delivery reunited the whole friend-group for a surprise.", detail: "Lesson about slowing down to listen." },
      { seriesId: series.id, category: "rule", summary: "Every episode resolves kindly with a cozy ending and a seed for the next.", detail: "Format rule enforced by the story planner stage." },
    ],
  });

  // =========================================================================
  // EPISODES
  // =========================================================================
  // Helper to build SEO blocks consistently.
  const seoFor = (num: number, title: string, lesson: string) => ({
    title: `${title} | Pip & Bramble Ep ${num} 🦊🐻 Cartoons for Kids`,
    description:
      `Join Pip the curious fox and Bramble the gentle bear in "${title}"! ` +
      `Today's gentle lesson: ${lesson}. A wholesome, screen-safe cartoon for ages 3-8. ` +
      `New episodes every day! 💛`,
    tags: ["kids cartoon", "pip and bramble", "preschool", "bedtime story", "kindness", "learning", lesson],
    keywords: ["cartoons for kids", "kids learning", "wholesome cartoon", "preschool show"],
    hashtags: ["#kidscartoon", "#pipandbramble", "#preschool", "#kindness"],
    chapters: [
      { start: 0, title: "Cold open" },
      { start: 60, title: "The discovery" },
      { start: 240, title: "A little problem" },
      { start: 540, title: "The lesson" },
      { start: 780, title: "Cozy ending" },
    ],
  });

  type EpSpec = {
    number: number;
    title: string;
    lesson: string;
    hook: string;
    outline: string[];
    cliffhanger: string;
    nextSetup: string;
  };

  const publishedSpecs: EpSpec[] = [
    {
      number: 1,
      title: "The Whispering Path",
      lesson: "pausing to think helps you find your way",
      hook: "Pip dashes off after a giggling breeze and forgets the way home!",
      outline: [
        "Cold open: Pip hears the woods whispering and bolts after the sound.",
        "Bramble worriedly follows, dropping honey-oats as breadcrumbs.",
        "They reach an unfamiliar clearing and realize they're lost.",
        "Pip remembers his brass compass and they take a breath.",
        "Together they retrace the honey-oat trail home.",
      ],
      cliffhanger: "A single glowing berry rolls out of the bushes…",
      nextSetup: "Where did that glowing berry come from? (sets up the Library)",
    },
    {
      number: 2,
      title: "Bramble's Big Voice",
      lesson: "even shy friends can be brave",
      hook: "A tiny duckling is stuck on a creek stone and only Bramble can reach it!",
      outline: [
        "Cold open: a worried peep echoes from Crystal Creek.",
        "The friends find a duckling stranded on a slippery stone.",
        "Bramble freezes, too shy to wade in.",
        "Pip cheers him on; Bramble finds his big, gentle voice.",
        "Bramble carefully carries the duckling to its mama.",
      ],
      cliffhanger: "The grateful mama duck whispers about a wise old owl…",
      nextSetup: "Who is the wise old owl? (introduces Olive)",
    },
    {
      number: 3,
      title: "Pip Counts to Five",
      lesson: "count to five before you decide",
      hook: "Pip's quick choices keep tipping over the picnic — can he learn to slow down?",
      outline: [
        "Cold open: Pip rushes the picnic and spills the lemonade.",
        "Each hasty fix makes a bigger mess.",
        "Olive teaches Pip the 'count to five' trick.",
        "Pip tries it and calmly sets the picnic right.",
        "Everyone enjoys a tidy, happy meadow feast.",
      ],
      cliffhanger: "Olive mentions a library hidden inside the oldest oak…",
      nextSetup: "The friends decide to find the Old Oak Library.",
    },
    {
      number: 4,
      title: "The Cozy Dark",
      lesson: "the dark can be cozy, not scary",
      hook: "Inside the Old Oak Library it's dark — and Bramble isn't sure he likes it.",
      outline: [
        "Cold open: the friends squeeze through the oak's hollow door.",
        "It's dark inside and Bramble wants to leave.",
        "Olive lights the berry lanterns one by one.",
        "The dark becomes a warm, glowing reading-nook.",
        "They share their very first library story.",
      ],
      cliffhanger: "A book about a pebble-powered kite catches Hazel's eye…",
      nextSetup: "Hazel decides to build the kite from the book.",
    },
    {
      number: 5,
      title: "Hazel's Sharing Kite",
      lesson: "sharing makes the fun bigger",
      hook: "Hazel builds an amazing kite — but only wants to fly it herself.",
      outline: [
        "Cold open: Hazel unveils her pebble-powered kite. Ta-daa!",
        "She zooms around but won't let anyone else try.",
        "The kite is more fun when no one is watching… or is it?",
        "Hazel notices her friends' sad faces and shares a turn.",
        "Everyone flies the kite together at golden hour.",
      ],
      cliffhanger: "A breathless robin arrives with an urgent leaf-letter…",
      nextSetup: "What's Rusty's urgent message?",
    },
    {
      number: 6,
      title: "Rusty's Slow-Down Delivery",
      lesson: "slow down and really listen",
      hook: "Rusty is in such a hurry that nobody can understand his big news!",
      outline: [
        "Cold open: Rusty zooms in, words tumbling too fast to follow.",
        "The friends keep mishearing the message.",
        "Pip uses his 'count to five' to help Rusty breathe.",
        "Rusty slows down: it's a surprise meadow party!",
        "Everyone gathers for a cozy golden-hour celebration.",
      ],
      cliffhanger: "An invitation flutters down addressed to 'a new friend'…",
      nextSetup: "Who is the mysterious new friend arriving in the woods?",
    },
  ];

  const publishedEpisodes: Episode[] = [];
  for (let i = 0; i < publishedSpecs.length; i++) {
    const spec = publishedSpecs[i];
    // Episode 1 published longest ago; episode 6 most recent.
    const publishedAt = daysAgo((publishedSpecs.length - i) * 4 + 2);
    const ep = await prisma.episode.create({
      data: {
        seriesId: series.id,
        number: spec.number,
        title: spec.title,
        status: "PUBLISHED",
        hook: spec.hook,
        outline: spec.outline.map((beat, idx) => ({ index: idx, beat })),
        cliffhanger: spec.cliffhanger,
        nextSetup: spec.nextSetup,
        targetSeconds: 900,
        seo: seoFor(spec.number, spec.title, spec.lesson),
        videoUrl: `https://cdn.toonfactory.dev/videos/ep${spec.number}.mp4`,
        thumbnailUrl: `https://cdn.toonfactory.dev/thumbs/ep${spec.number}-final.png`,
        youtubeId: `PIPBR${String(spec.number).padStart(2, "0")}xZ`,
        publishedAt,
        costMicroUsd: usd(2 + spec.number * 0.4), // ~$2.40 … $4.40 per episode
      },
    });
    publishedEpisodes.push(ep);
  }

  // Episode 7 — SCHEDULED for the near future.
  const ep7 = await prisma.episode.create({
    data: {
      seriesId: series.id,
      number: 7,
      title: "Welcome, Willow",
      status: "SCHEDULED",
      hook: "A shy new fawn named Willow tiptoes into the woods — will she find a friend?",
      outline: [
        { index: 0, beat: "Cold open: a new fawn peeks from behind the oaks." },
        { index: 1, beat: "Willow is too shy to come closer." },
        { index: 2, beat: "Bramble, remembering his own shyness, leads the welcome." },
        { index: 3, beat: "The friends make Willow a daisy-crown gift." },
        { index: 4, beat: "Willow joins the group for a cozy meadow picnic." },
      ],
      cliffhanger: "Willow knows a path no one has explored before…",
      nextSetup: "The unexplored path beyond Crystal Creek.",
      targetSeconds: 900,
      seo: seoFor(7, "Welcome, Willow", "welcoming new friends"),
      thumbnailUrl: "https://cdn.toonfactory.dev/thumbs/ep7-final.png",
      videoUrl: "https://cdn.toonfactory.dev/videos/ep7.mp4",
      scheduledFor: daysFromNow(1),
      costMicroUsd: usd(3.6),
    },
  });

  // Episode 8 — mid-production (ANIMATION stage).
  const ep8 = await prisma.episode.create({
    data: {
      seriesId: series.id,
      number: 8,
      title: "The Path Beyond the Creek",
      status: "ANIMATION",
      hook: "Willow leads the friends across Crystal Creek to a path nobody has seen!",
      outline: [
        { index: 0, beat: "Cold open: Willow points to a hidden path." },
        { index: 1, beat: "The friends gather their courage and supplies." },
        { index: 2, beat: "They cross the stepping stones of Crystal Creek." },
        { index: 3, beat: "A small obstacle tests their teamwork." },
        { index: 4, beat: "They discover a sunny new glade — and a tiny lost map." },
      ],
      cliffhanger: "The little map shows a place none of them recognize…",
      nextSetup: "Decoding the mysterious map.",
      targetSeconds: 900,
      seo: seoFor(8, "The Path Beyond the Creek", "teamwork"),
      costMicroUsd: usd(1.8), // partial — only stages completed so far
    },
  });

  const allEpisodes = [...publishedEpisodes, ep7, ep8];

  // =========================================================================
  // SCENES (for a few episodes so the Story/Production views are rich)
  // =========================================================================
  const charIdsAll = characters.map((c) => c.id);

  type SceneSpec = {
    heading: string;
    description: string;
    locationRef: string;
    chars: string[];
    narration: string;
    dialogue: { characterId: string; line: string; emotion: string }[];
    mood: string;
    durationSec: number;
    imagePrompt: string;
  };

  function buildScenes(ep: { id: string; number: number }, specs: SceneSpec[]) {
    return specs.map((s, index) => ({
      episodeId: ep.id,
      index,
      heading: s.heading,
      description: s.description,
      locationRef: s.locationRef,
      characters: s.chars,
      narration: s.narration,
      dialogue: s.dialogue,
      mood: s.mood,
      durationSec: s.durationSec,
      imagePrompt: s.imagePrompt,
      imageUrl: `https://cdn.toonfactory.dev/frames/ep${ep.number}/scene-${index}.png`,
      clipUrl: `https://cdn.toonfactory.dev/clips/ep${ep.number}/scene-${index}.mp4`,
      voiceUrls: s.dialogue.map(
        (_d, di) => `https://cdn.toonfactory.dev/voice/ep${ep.number}/s${index}-line${di}.mp3`,
      ),
      musicUrl: `https://cdn.toonfactory.dev/music/ep${ep.number}/scene-${index}.mp3`,
    }));
  }

  const ep1Scenes: SceneSpec[] = [
    {
      heading: "INT/EXT — Whispering Woods — Golden Hour",
      description: "Pip's ears twitch at a giggling breeze threading through the oaks.",
      locationRef: locWoods.id,
      chars: [pip.id, bramble.id],
      narration: "On a warm and whispery morning, Pip the fox heard the woods telling secrets.",
      dialogue: [
        { characterId: pip.id, line: "Did you hear that? Let's find out!", emotion: "excited" },
        { characterId: bramble.id, line: "Maybe we should think first?", emotion: "worried" },
      ],
      mood: "curious",
      durationSec: 95,
      imagePrompt:
        "Pip the fox kit perking his ears toward a swirl of leaves in a golden-hour forest, Bramble behind looking unsure, soft 2D storybook style, thick outlines",
    },
    {
      heading: "EXT — Deeper in the Woods",
      description: "Pip dashes ahead; Bramble drops honey-oats as a trail.",
      locationRef: locWoods.id,
      chars: [pip.id, bramble.id],
      narration: "Pip ran so fast that Bramble had to leave a trail of crunchy honey-oats.",
      dialogue: [
        { characterId: bramble.id, line: "Wait for me, Pip!", emotion: "anxious" },
        { characterId: pip.id, line: "Almost there! I think!", emotion: "breathless" },
      ],
      mood: "adventurous",
      durationSec: 110,
      imagePrompt:
        "Pip sprinting through dappled forest light, Bramble trotting behind dropping little oats, motion lines, soft 2D storybook style",
    },
    {
      heading: "EXT — Unfamiliar Clearing",
      description: "The friends stop, realizing nothing looks familiar.",
      locationRef: locWoods.id,
      chars: [pip.id, bramble.id],
      narration: "But when the giggling breeze went quiet, the woods looked brand new — and a little big.",
      dialogue: [
        { characterId: pip.id, line: "Oh… which way is home?", emotion: "uncertain" },
        { characterId: bramble.id, line: "It's okay. Let's take a breath.", emotion: "gentle" },
      ],
      mood: "tense-soft",
      durationSec: 100,
      imagePrompt:
        "Pip and Bramble standing small in a wide unfamiliar clearing, soft worried expressions, warm light, soft 2D storybook style",
    },
    {
      heading: "EXT — Clearing — The Compass",
      description: "Pip remembers his brass compass; they calm down and plan.",
      locationRef: locWoods.id,
      chars: [pip.id, bramble.id],
      narration: "Then Pip remembered the little brass compass swinging at his chest.",
      dialogue: [
        { characterId: pip.id, line: "My compass! And your honey-oat trail!", emotion: "relieved" },
        { characterId: bramble.id, line: "Thinking first really works.", emotion: "proud" },
      ],
      mood: "hopeful",
      durationSec: 105,
      imagePrompt:
        "Close-up of Pip holding a glowing brass compass, Bramble pointing at a trail of oats, golden light, soft 2D storybook style",
    },
    {
      heading: "EXT — Edge of the Woods — Home",
      description: "Following the trail home; a glowing berry rolls out.",
      locationRef: locWoods.id,
      chars: [pip.id, bramble.id],
      narration: "Step by careful step, the trail of oats led them all the way home.",
      dialogue: [
        { characterId: pip.id, line: "Next time, I'll pause before I dash.", emotion: "thoughtful" },
        { characterId: bramble.id, line: "And I'll be right beside you.", emotion: "warm" },
      ],
      mood: "cozy",
      durationSec: 120,
      imagePrompt:
        "Pip and Bramble walking home at golden hour, a single softly-glowing berry rolling from a bush, soft 2D storybook style",
    },
  ];

  const ep4Scenes: SceneSpec[] = [
    {
      heading: "EXT — Old Oak — The Hollow Door",
      description: "The friends squeeze through the ancient oak's round door.",
      locationRef: locLibrary.id,
      chars: [pip.id, bramble.id, olive.id],
      narration: "The oldest oak had a tiny round door, and behind it… the dark.",
      dialogue: [
        { characterId: pip.id, line: "Ooh, a secret library!", emotion: "excited" },
        { characterId: bramble.id, line: "It's awfully dark in here…", emotion: "nervous" },
      ],
      mood: "mysterious-soft",
      durationSec: 100,
      imagePrompt:
        "Pip, Bramble and Olive the owl entering a dim hollow inside a giant oak, tiny round door behind them, soft 2D storybook style",
    },
    {
      heading: "INT — Library — First Lantern",
      description: "Olive lights the first berry lantern; warmth spreads.",
      locationRef: locLibrary.id,
      chars: [bramble.id, olive.id],
      narration: "Olive the owl smiled and touched a single glowing berry.",
      dialogue: [
        { characterId: olive.id, line: "Whooo says the dark can't be cozy?", emotion: "playful" },
        { characterId: bramble.id, line: "Oh! It's… warm.", emotion: "surprised" },
      ],
      mood: "wonder",
      durationSec: 115,
      imagePrompt:
        "Olive the owl lighting a glowing berry lantern in a dim wooden library, warm glow on Bramble's relieved face, soft 2D storybook style",
    },
    {
      heading: "INT — Library — Reading Nook",
      description: "Lanterns reveal a snug spiral of reading-nooks.",
      locationRef: locLibrary.id,
      chars: [pip.id, bramble.id, olive.id],
      narration: "One by one the lanterns glowed, and the scary dark became a snug, golden nook.",
      dialogue: [
        { characterId: pip.id, line: "It's like a hug made of light!", emotion: "delighted" },
        { characterId: bramble.id, line: "I'm not scared anymore.", emotion: "brave" },
      ],
      mood: "cozy",
      durationSec: 110,
      imagePrompt:
        "A spiral of cozy reading nooks lit by warm berry lanterns, three friends settling in with picture books, soft 2D storybook style",
    },
    {
      heading: "INT — Library — Story Time",
      description: "They share their first library story together.",
      locationRef: locLibrary.id,
      chars: [pip.id, bramble.id, olive.id],
      narration: "And so they shared their very first library story, snug in the cozy dark.",
      dialogue: [
        { characterId: olive.id, line: "Whooo wants to learn something new?", emotion: "warm" },
        { characterId: bramble.id, line: "Me! The dark can be cozy after all.", emotion: "happy" },
      ],
      mood: "heartwarming",
      durationSec: 125,
      imagePrompt:
        "Olive reading a picture book to Pip and Bramble in a warm lantern-lit nook, a kite book glowing on a shelf, soft 2D storybook style",
    },
    {
      heading: "INT — Library — The Kite Book",
      description: "Hazel's eye catches a book about a pebble-powered kite (cliffhanger).",
      locationRef: locLibrary.id,
      chars: [hazel.id],
      narration: "But one little book about a pebble-powered kite was about to start a brand new adventure.",
      dialogue: [{ characterId: hazel.id, line: "A pebble-powered kite? Ta-daa-mazing!", emotion: "thrilled" }],
      mood: "anticipation",
      durationSec: 90,
      imagePrompt:
        "Hazel the hedgehog wide-eyed at a glowing book showing a pebble-powered kite, soft 2D storybook style",
    },
  ];

  const ep8Scenes: SceneSpec[] = [
    {
      heading: "EXT — Crystal Creek — The Hidden Path",
      description: "Willow points across the creek to an unseen path (storyboarded/animating).",
      locationRef: locCreek.id,
      chars: [pip.id, bramble.id],
      narration: "Beyond the stepping stones, Willow showed them a path no one had ever explored.",
      dialogue: [
        { characterId: pip.id, line: "A brand new path! Let's plan it out first.", emotion: "eager" },
        { characterId: bramble.id, line: "Good idea — together we can do it.", emotion: "confident" },
      ],
      mood: "adventurous",
      durationSec: 105,
      imagePrompt:
        "Pip and Bramble at the edge of Crystal Creek looking across stepping stones to a mysterious sunlit path, soft 2D storybook style",
    },
    {
      heading: "EXT — Crystal Creek — Crossing",
      description: "The friends cross the stepping stones using teamwork.",
      locationRef: locCreek.id,
      chars: [pip.id, bramble.id],
      narration: "Stone by stone, they helped each other across the sparkling creek.",
      dialogue: [
        { characterId: bramble.id, line: "I'll steady the stone, you hop!", emotion: "helpful" },
        { characterId: pip.id, line: "Teamwork! Almost across!", emotion: "joyful" },
      ],
      mood: "teamwork",
      durationSec: 115,
      imagePrompt:
        "Pip hopping across stepping stones while Bramble steadies a wobbly stone, dragonflies and sparkles, soft 2D storybook style",
    },
    {
      heading: "EXT — New Glade — Discovery",
      description: "They reach a sunny new glade and spot a tiny lost map.",
      locationRef: locWoods.id,
      chars: [pip.id, bramble.id],
      narration: "On the far side, a sunny new glade waited — and something small and curious in the grass.",
      dialogue: [
        { characterId: pip.id, line: "Look! A teeny tiny map!", emotion: "amazed" },
        { characterId: bramble.id, line: "I wonder where it leads…", emotion: "curious" },
      ],
      mood: "wonder",
      durationSec: 120,
      imagePrompt:
        "Pip and Bramble discovering a tiny rolled map in a sunlit new glade, soft 2D storybook style",
    },
  ];

  await prisma.scene.createMany({ data: buildScenes(publishedEpisodes[0], ep1Scenes) });
  await prisma.scene.createMany({ data: buildScenes(publishedEpisodes[3], ep4Scenes) });
  await prisma.scene.createMany({ data: buildScenes(ep8, ep8Scenes) });

  // =========================================================================
  // ASSETS (content-addressed; demonstrates caching/reuse)
  // =========================================================================
  // Character design assets reused across every episode (cache hits).
  const characterAssetData = characters.map((c, i) => ({
    episodeId: publishedEpisodes[0].id,
    kind: "CHARACTER" as const,
    provider: "openai",
    cacheKey: `char-design:${c.id}`,
    prompt: c.designToken,
    url: c.refImageUrl ?? `https://cdn.toonfactory.dev/refs/char-${i}.png`,
    meta: { reusedAcrossEpisodes: true, width: 1024, height: 1024 },
    costMicroUsd: usd(0.04),
  }));
  await prisma.asset.createMany({ data: characterAssetData });

  // A few per-episode background / clip / voice / video / thumbnail assets.
  const perEpisodeAssets: Prisma.AssetCreateManyInput[] = [];

  for (const ep of publishedEpisodes) {
    perEpisodeAssets.push(
      {
        episodeId: ep.id,
        kind: "BACKGROUND",
        provider: "openai",
        cacheKey: `bg:ep${ep.number}:woods`,
        prompt: "Whispering Woods golden-hour background plate, soft 2D storybook style",
        url: `https://cdn.toonfactory.dev/bg/ep${ep.number}-woods.png`,
        meta: { width: 1920, height: 1080 },
        costMicroUsd: usd(0.06),
      },
      {
        episodeId: ep.id,
        kind: "CLIP",
        provider: "mock",
        cacheKey: `clip:ep${ep.number}:s0`,
        prompt: "Animated establishing shot, gentle camera pan-right",
        url: `https://cdn.toonfactory.dev/clips/ep${ep.number}/scene-0.mp4`,
        meta: { durationSec: 95, camera: "pan-right" },
        costMicroUsd: usd(0.3),
      },
      {
        episodeId: ep.id,
        kind: "VOICE",
        provider: "elevenlabs",
        cacheKey: `voice:ep${ep.number}:narration`,
        prompt: "Episode narration track",
        url: `https://cdn.toonfactory.dev/voice/ep${ep.number}/narration.mp3`,
        meta: { durationSec: 540, voiceId: "narrator_warm_v1" },
        costMicroUsd: usd(0.4),
      },
      {
        episodeId: ep.id,
        kind: "MUSIC",
        provider: "mock",
        cacheKey: `music:ep${ep.number}:bgm`,
        prompt: "Gentle cozy background music bed",
        url: `https://cdn.toonfactory.dev/music/ep${ep.number}/bgm.mp3`,
        meta: { durationSec: 900, mood: "cozy" },
        costMicroUsd: usd(0.1),
      },
      {
        episodeId: ep.id,
        kind: "VIDEO",
        provider: "ffmpeg",
        cacheKey: `video:ep${ep.number}:final`,
        prompt: "Final assembled episode mp4",
        url: `https://cdn.toonfactory.dev/videos/ep${ep.number}.mp4`,
        meta: { durationSec: 900, resolution: "1920x1080" },
        costMicroUsd: usd(0.05),
      },
    );
  }
  await prisma.asset.createMany({ data: perEpisodeAssets });

  // =========================================================================
  // THUMBNAILS — 3 per published episode, highest score chosen.
  // =========================================================================
  for (const ep of publishedEpisodes) {
    const scores = [
      jitter(68, 6),
      jitter(80, 6),
      jitter(90, 4),
    ].sort((a, b) => a - b);
    const variants = ["faces-closeup", "wide-action", "emoji-pop"];
    for (let v = 0; v < 3; v++) {
      const score = Math.max(60, Math.min(95, scores[v]));
      await prisma.thumbnail.create({
        data: {
          episodeId: ep.id,
          url: `https://cdn.toonfactory.dev/thumbs/ep${ep.number}-${variants[v]}.png`,
          prompt: `Thumbnail variant "${variants[v]}" for "${ep.title}" — bright, high-contrast, kid-friendly faces`,
          score,
          scoreDetail: {
            clarity: jitter(score, 5),
            emotion: jitter(score, 6),
            contrast: jitter(score, 5),
            curiosity: jitter(score, 7),
          },
          chosen: v === 2, // highest-scoring variant is chosen
        },
      });
    }
  }

  // =========================================================================
  // ANALYTICS SNAPSHOTS — growth over the last 30 days per published episode.
  // =========================================================================
  for (let e = 0; e < publishedEpisodes.length; e++) {
    const ep = publishedEpisodes[e];
    // Older episodes have accumulated more total views.
    const ageBoost = (publishedEpisodes.length - e) * 1.2;
    // Capture roughly weekly snapshots over the last 28 days.
    const offsets = [28, 21, 14, 7, 1];
    let cumulativeViews = 0;
    let cumulativeSubs = 0;
    for (let s = 0; s < offsets.length; s++) {
      const growthStep = Math.round((400 + e * 30) * ageBoost * (1 + s * 0.6));
      cumulativeViews += growthStep;
      const subsStep = jitter(8 + e * 2, 3);
      cumulativeSubs += subsStep;
      const ctr = +(0.04 + Math.random() * 0.05).toFixed(4); // 0.04..0.09
      const avgViewPct = +(0.35 + Math.random() * 0.25).toFixed(4); // 0.35..0.6
      const impressions = Math.round(cumulativeViews / ctr);
      const watchTimeMin = Math.round((cumulativeViews * 8 * avgViewPct) / 60); // ~8 min runtime
      const rpmUsd = +(1 + Math.random() * 3).toFixed(2); // $1..$4
      const revenueUsd = +((cumulativeViews / 1000) * rpmUsd).toFixed(2);
      await prisma.analyticsSnapshot.create({
        data: {
          episodeId: ep.id,
          capturedAt: daysAgo(offsets[s]),
          views: cumulativeViews,
          watchTimeMin,
          impressions,
          ctr,
          avgViewPct,
          subsGained: subsStep,
          likes: Math.round(cumulativeViews * 0.03),
          comments: Math.round(cumulativeViews * 0.004),
          rpmUsd,
          revenueUsd,
        },
      });
    }
  }

  // =========================================================================
  // CHANNEL STATS — ~12 weekly rows trending toward monetization thresholds.
  // =========================================================================
  // Target: 1000 subs / 4000 watch hours. Latest ≈ 780 subs / ≈3100 hours.
  for (let w = 11; w >= 0; w--) {
    const t = (11 - w) / 11; // 0 → 1 across the 12 weeks
    const subscribers = Math.round(120 + t * (780 - 120) + jitter(0, 8));
    const watchTimeHours = +(500 + t * (3100 - 500) + jitter(0, 40)).toFixed(1);
    const totalViews = Math.round(8000 + t * (62000 - 8000) + jitter(0, 500));
    await prisma.channelStat.create({
      data: {
        capturedAt: daysAgo(w * 7),
        subscribers,
        totalViews,
        watchTimeHours,
        monetized: false, // not yet at 1000 subs / 4000 hours
      },
    });
  }

  // =========================================================================
  // COST EVENTS — ledger across providers/categories for published episodes.
  // =========================================================================
  const costRecipe: { category: string; provider: string; unit: string; units: number; micro: number }[] = [
    { category: "llm", provider: "anthropic", unit: "ktok", units: 14, micro: usd(0.21) },
    { category: "image", provider: "openai", unit: "image", units: 12, micro: usd(0.48) },
    { category: "voice", provider: "elevenlabs", unit: "kchar", units: 6, micro: usd(0.36) },
    { category: "music", provider: "mock", unit: "track", units: 3, micro: usd(0.1) },
    { category: "animation", provider: "mock", unit: "clip", units: 8, micro: usd(0.8) },
    { category: "video", provider: "ffmpeg", unit: "render", units: 1, micro: usd(0.05) },
    { category: "upload", provider: "youtube", unit: "upload", units: 1, micro: usd(0.0) },
  ];
  const costEvents: {
    episodeId: string;
    provider: string;
    category: string;
    units: number;
    unit: string;
    costMicroUsd: number;
    createdAt: Date;
  }[] = [];
  for (const ep of publishedEpisodes) {
    for (const r of costRecipe) {
      costEvents.push({
        episodeId: ep.id,
        provider: r.provider,
        category: r.category,
        units: r.units,
        unit: r.unit,
        costMicroUsd: r.micro,
        createdAt: ep.publishedAt ?? daysAgo(5),
      });
    }
  }
  await prisma.costEvent.createMany({ data: costEvents });

  // =========================================================================
  // LOG ENTRIES — mixed levels across scopes.
  // =========================================================================
  const ep1 = publishedEpisodes[0];
  await prisma.logEntry.createMany({
    data: [
      { level: "INFO", scope: "worker", message: "Worker started; polling job queue every 2s.", createdAt: daysAgo(30) },
      { level: "INFO", scope: "pipeline", episodeId: ep1.id, message: "Episode 1 'plan' stage completed.", createdAt: daysAgo(26) },
      { level: "INFO", scope: "pipeline", episodeId: ep1.id, message: "Episode 1 'script' stage completed (5 scenes).", createdAt: daysAgo(26) },
      { level: "WARN", scope: "pipeline", episodeId: ep1.id, message: "Image provider rate-limited; retrying with backoff (attempt 2/3).", createdAt: daysAgo(26) },
      { level: "INFO", scope: "pipeline", episodeId: ep1.id, message: "Episode 1 'images' stage completed (cache hit on 4 character assets).", createdAt: daysAgo(26) },
      { level: "INFO", scope: "upload", episodeId: ep1.id, message: "Episode 1 uploaded to YouTube as PIPBR01xZ.", createdAt: daysAgo(26) },
      { level: "INFO", scope: "pipeline", episodeId: publishedEpisodes[2].id, message: "Episode 3 published successfully.", createdAt: daysAgo(14) },
      { level: "WARN", scope: "worker", message: "Job lease expired for stuck job; re-queued.", createdAt: daysAgo(12) },
      { level: "ERROR", scope: "pipeline", episodeId: publishedEpisodes[4].id, message: "Voice synth timed out on scene 3; falling back to mock voice.", createdAt: daysAgo(8) },
      { level: "INFO", scope: "pipeline", episodeId: publishedEpisodes[4].id, message: "Episode 5 recovered after retry; published.", createdAt: daysAgo(8) },
      { level: "INFO", scope: "analytics", message: "Pulled YouTube analytics for 6 published episodes.", createdAt: daysAgo(2) },
      { level: "INFO", scope: "pipeline", episodeId: ep7.id, message: "Episode 7 rendered and scheduled.", createdAt: daysAgo(1) },
      { level: "INFO", scope: "pipeline", episodeId: ep8.id, message: "Episode 8 entered 'animation' stage.", createdAt: daysAgo(0) },
      { level: "WARN", scope: "upload", episodeId: ep8.id, message: "Animation provider in mock mode; clips are placeholders.", createdAt: daysAgo(0) },
      { level: "ERROR", scope: "worker", message: "Transient DB connection reset; reconnected automatically.", createdAt: daysAgo(0) },
    ],
  });

  // A couple of jobs to show queue activity for the in-flight episode.
  await prisma.job.createMany({
    data: [
      {
        episodeId: ep8.id,
        stage: "animation",
        status: "RUNNING",
        priority: 5,
        attempts: 1,
        payload: { episodeId: ep8.id, scenes: 3 },
        lockedBy: "worker-1",
        lockedAt: daysAgo(0),
      },
      {
        episodeId: ep8.id,
        stage: "voice",
        status: "QUEUED",
        priority: 4,
        payload: { episodeId: ep8.id },
        runAfter: new Date(Date.now() + 60_000),
      },
      {
        episodeId: ep7.id,
        stage: "upload",
        status: "SUCCEEDED",
        attempts: 1,
        payload: { episodeId: ep7.id, schedule: true },
        result: { youtubeStatus: "scheduled", scheduledFor: daysFromNow(1).toISOString() },
      },
    ],
  });

  // =========================================================================
  // RECOMMENDATIONS — AI optimization suggestions.
  // =========================================================================
  await prisma.recommendation.createMany({
    data: [
      {
        area: "thumbnails",
        title: "Use close-up character faces on thumbnails",
        detail: "Face-closeup variants scored ~12 points higher than wide shots. Bias generation toward expressive close-ups.",
        impact: "high",
      },
      {
        area: "titles",
        title: "Lead titles with the emotional hook",
        detail: "Titles starting with the feeling (e.g. 'Bramble's Big Voice') outperform plot-summary titles in CTR.",
        impact: "medium",
      },
      {
        area: "pacing",
        title: "Tighten the cold open to under 45 seconds",
        detail: "Retention dips when the hook runs long. Move the first lesson beat earlier.",
        impact: "medium",
      },
      {
        area: "length",
        title: "Target 8-9 minute episodes for this age group",
        detail: "avgViewPct is highest at ~8 min. Longer cuts lose 3-8 year-olds.",
        impact: "high",
      },
      {
        area: "schedule",
        title: "Publish the second daily episode at 18:00 local",
        detail: "Evening 'wind-down' slot shows stronger watch-time for kids content.",
        impact: "low",
      },
      {
        area: "revenue",
        title: "Add an end-screen to the next episode in the series",
        detail: "Linking each episode to the next lifts session watch-time toward the 4000-hour goal.",
        impact: "high",
      },
    ],
  });

  // =========================================================================
  // SETTINGS — key/value store.
  // =========================================================================
  await prisma.setting.createMany({
    data: [
      { key: "schedule", value: { episodesPerDay: 2, times: ["08:00", "18:00"], timezone: "America/New_York" } },
      { key: "branding", value: { channelName: "Pip & Bramble", endScreen: true, intro: true, outro: true } },
    ],
  });

  // -------------------------------------------------------------------------
  console.log("✅ Seed complete:");
  console.log(`   • 1 series, ${characters.length} characters, 5 locations`);
  console.log(`   • ${allEpisodes.length} episodes (6 published, 1 scheduled, 1 in production)`);
  console.log("   • scenes, assets, thumbnails, analytics, channel stats, costs, logs, recs, settings");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
