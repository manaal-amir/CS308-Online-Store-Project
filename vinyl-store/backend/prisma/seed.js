const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");

async function main() {
  console.log("Seeding database...");

  // -----Categories------
  const categoryNames = ["Vinyl", "Record Player", "Accessory"]; //might add more

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ------Genres--------
    const genres = [
    { name: "Jazz", 
        description: `Jazz is a genre built on improvisation, where musicians create solos on the spot. 
    Born in early 20th-century New Orleans from blues, ragtime, and spirituals, it evolved through 
    swing, bebop, and fusion. Ranging from sorrow to pure joy, jazz has long been a voice of freedom 
    for people facing injustice and oppression.`},

    { name: "Rock", 
        description: `Rock is a genre driven by electric guitars, strong backbeats, and raw energy. 
        Emerging in 1950s America from blues, country, and rhythm and blues, it grew into punk, metal, 
        grunge, and alternative. Loud and rebellious, rock has long been the sound of youth pushing back 
        against convention.` },


    { name: "Hip-Hop/Rap", 
        description: `Hip-hop is a genre centered on rhythmic vocals, beats, and sampling. Born in 1970s 
        New York block parties, it grew from DJing and MCing into a global culture spanning fashion, dance,
        and art. Rap has long given a voice to communities telling their own stories of struggle, pride, and
        ambition.`},


    { name: "Pop", 
        description: `Pop is a genre built on catchy melodies, memorable hooks, and broad appeal. Taking shape
        in the 1950s and ’60s alongside radio and television, it constantly absorbs elements of rock, dance,
        and R&B. Bright and accessible, pop captures the moods and trends of each generation.` },


    { name: "Electronic", 
        description: `Electronic music is built with synthesizers, drum machines, and digital production. 
        Rising from experimental studios and the disco and club scenes of the 1970s and '80s, it branched
        into house, techno, trance, and drum and bass. Hypnotic and inventive, it fuels dance floors and
        pushes the boundaries of sound.` },


    { name: "Classical", 
        description: `Classical is a tradition of composed music rooted in centuries of European history,
        from the Baroque through the Classical and Romantic eras to modern works. Performed by orchestras,
        ensembles, and soloists, it is known for its rich structure and expressive depth. Its pieces range
        from intimate and calm to grand and dramatic.` },
  ];

  for (const genre of genres) {
    await prisma.genre.upsert({
      where: { name: genre.name },
      update: {},
      create: {
        name: genre.name,
        description: genre.description.replace(/\s+/g, " ").trim(),
        },
    });
  }

    // ----- Artists ----
  const artists = [
    {
      name: "Frank Sinatra",
      description: `Frank Sinatra was an American singer and actor, often called “Ol' Blue Eyes,” 
      whose smooth phrasing defined the golden age of vocal pop and swing. Rising from 1940s big bands
       to solo stardom, he recorded classic albums of standards and saloon songs for over five decades. 
       His voice, by turns romantic, confident, and melancholy, made him one of the most influential singers 
       of the 20th century.`,
      imageUrl: null,       // or a link to an image
      genre: "Jazz",  // must match one of your genre names exactly
    },
    {
      name: "Louis Armstrong",
      description: `Louis Armstrong was a New Orleans-born trumpeter and singer whose dazzling solos helped
       turn jazz into a soloist's art. Known as “Satchmo,” he shaped the sound of 1920s jazz and later found
        worldwide fame with his gravelly voice and warm charm. His joyful spirit and innovation made him one
         of the most beloved figures in music history.`,
      imageUrl: null,
      genre: "Jazz",
    },
    {
      name: "Laufey",
      description: `Laufey is an Icelandic-Chinese singer-songwriter who blends jazz, classical, and bossa
       nova into a fresh, modern sound. Trained in cello and piano, she brings the elegance of vintage jazz
        standards to a new generation with intimate songs about love and longing. Her Grammy-winning work
         has made her a leading voice in the revival of jazz among young listeners.`,
      imageUrl: null,       // or a link to an image
      genre: "Jazz",  // must match one of your genre names exactly
    },
    {
      name: "The Doors",
      description: `The Doors were an American rock band formed in Los Angeles in 1965, known for their dark, poetic lyrics
       and hypnotic organ-driven sound. Blending blues, psychedelia, and theatrical performance, they became icons of the 1960s
        counterculture. Their mysterious, rebellious spirit still makes them one of rock’s most legendary acts.`,
      imageUrl: null,       // or a link to an image
      genre: "Rock",  // must match one of your genre names exactly
    },
    {
      name: "Queen",
      description: `Queen was a British rock band formed in London in 1970, famous for their theatrical style, layered harmonies,
       and genre-blending ambition. Mixing hard rock, opera, pop, and disco, they created some of the most recognizable anthems
        in music history. Their electrifying live shows made them one of the greatest performing bands of all time.`,
      imageUrl: null,       // or a link to an image
      genre: "Rock",  // must match one of your genre names exactly
    },
    {
      name: "Led Zeppelin",
      description: `Led Zeppelin was an English rock band formed in London in 1968, whose heavy riffs and thunderous drumming helped
       lay the foundations of hard rock and heavy metal. Drawing on blues, folk, and Eastern influences, they crafted epic songs
        of remarkable power and range. Their bold sound made them one of the best-selling and most influential bands ever.`,
      imageUrl: null,       // or a link to an image
      genre: "Rock",  // must match one of your genre names exactly
    },
    {
      name: "Elvis Presley",
      description: `Elvis Presley was an American singer and actor, known as the “King of Rock and Roll,” who brought the genre to
       the mainstream in the 1950s. Fusing country, gospel, and rhythm and blues, his voice and electrifying stage presence thrilled
        audiences and shocked conservatives. He remains one of the most celebrated and culturally significant figures of the 20th
         century.`,
      imageUrl: null,       // or a link to an image
      genre: "Rock",  // must match one of your genre names exactly
    },
    {
      name: "Pink Floyd",
      description: `Pink Floyd was an English rock band formed in London in 1965, pioneers of psychedelic and progressive rock.
       Known for concept albums, philosophical lyrics, and groundbreaking sound experiments, they explored themes of time, madness,
        and alienation. Their immersive records and spectacular live shows made them one of the best-selling bands in history.`,
      imageUrl: null,       // or a link to an image
      genre: "Rock",  // must match one of your genre names exactly
    },
    {
      name: "Taylor Swift",
      description: `Taylor Swift is an American singer-songwriter who rose to fame in country music before becoming
       one of pop's biggest stars. Known for her confessional, story-driven lyrics, she has moved fluidly between
        country, pop, and indie folk. Her record-breaking albums and tours have made her one of the most successful
         artists of her generation.`,
      imageUrl: null,       // or a link to an image
      genre: "Pop",  // must match one of your genre names exactly
    },
    {
      name: "The Weeknd",
      description: `The Weeknd is a Canadian singer and producer from Toronto, known for his falsetto voice and moody,
       atmospheric sound. Blending R&B, pop, and 1980s-inspired synths, he explores themes of excess, heartbreak, and
        fame. His cinematic style has made him one of the defining voices of modern pop and R&B.`,
      imageUrl: null,       // or a link to an image
      genre: "Pop",  // must match one of your genre names exactly
    },
    {
      name: "Chappell Roan",
      description: `Chappell Roan is an American singer-songwriter from Missouri known for her bold, theatrical pop
       and campy, colorful performances. Blending synth-pop, glam, and heartfelt storytelling, she sings about
        self-discovery, queer love, and small-town escape. Her breakout success and Grammy-winning rise have
         made her one of pop's most exciting new voices.`,
      imageUrl: null,       // or a link to an image
      genre: "Pop",  // must match one of your genre names exactly
    },
    {
      name: "Beethoven",
      description: `Ludwig van Beethoven was a German composer and pianist who bridged the Classical
       and Romantic eras. Despite gradually losing his hearing, he wrote some of the most powerful 
       symphonies, sonatas, and string quartets ever composed. His bold, emotional music reshaped 
       what classical music could express and remains endlessly performed today.`,
      imageUrl: null,       // or a link to an image
      genre: "Classical",  // must match one of your genre names exactly
    },
    {
      name: "Tchaikovsky",
      description: `Pyotr Ilyich Tchaikovsky was a Russian composer of the Romantic era, celebrated for his sweeping
       melodies and deep emotional intensity. His ballets, symphonies, and concertos blend Russian character with Western
        tradition. Beloved worldwide, his music is among the most popular and frequently performed in the classical repertoire.`,
      imageUrl: null,       // or a link to an image
      genre: "Classical",  // must match one of your genre names exactly
    },
    {
      name: "Vivaldi",
      description: `Antonio Vivaldi was an Italian Baroque composer and virtuoso violinist from Venice. 
      Known for his lively, vivid concertos, he helped shape the concerto form and influenced generations 
      of composers. His bright, energetic music, especially his famous seasonal concertos, remains some of 
      the most recognizable in classical music.`,
      imageUrl: null,       // or a link to an image
      genre: "Classical",  // must match one of your genre names exactly
    },
    {
      name: "Eminem",
      description: `Eminem is an American rapper from Detroit, known for his rapid-fire delivery, complex rhymes, 
      and provocative storytelling. Rising to fame in the late 1990s, he became one of the best-selling artists of 
      all time with raw, personal, and often controversial lyrics. His technical skill and intensity have made him 
      one of the most influential rappers in history.`,
      imageUrl: null,       // or a link to an image
      genre: "Hip-Hop/Rap",  // must match one of your genre names exactly
    },
    {
      name: "Drake",
      description: `Drake is a Canadian rapper, singer, and songwriter from Toronto who blends hip-hop with melodic 
      R&B. Known for his introspective lyrics about fame, relationships, and ambition, he has dominated the charts 
      since the late 2000s. His versatile style has made him one of the most commercially successful artists of the 
      modern era.`,
      imageUrl: null,       // or a link to an image
      genre: "Hip-Hop/Rap",  // must match one of your genre names exactly
    },
    {
      name: "Kendrick Lamar",
      description: `Kendrick Lamar is an American rapper from Compton, California, celebrated for his sharp lyricism and
       ambitious concept albums. Blending hip-hop with jazz, funk, and soul, he explores themes of race, identity, and 
       life in his community. Widely acclaimed and Pulitzer Prize-winning, he is regarded as one of the greatest rappers
        of his generation.`,
      imageUrl: null,       // or a link to an image
      genre: "Hip-Hop/Rap",  // must match one of your genre names exactly
    },
    {
      name: "Daft Punk",
      description: `Daft Punk was a French electronic duo from Paris, famous for their robot helmets and anonymous 
      public image. Fusing house, funk, disco, and synth-pop, they helped bring electronic music into the mainstream
       from the 1990s onward. Their groundbreaking sound and iconic visuals made them one of the most influential electronic
        acts ever.`,
      imageUrl: null,       // or a link to an image
      genre: "Electronic",  // must match one of your genre names exactly
    },
    {
      name: "The Chemical Brothers",
      description: `The Chemical Brothers are an English electronic duo from Manchester who helped pioneer the “big beat” sound
       of the 1990s. Combining heavy breakbeats, psychedelic samples, and rock energy, they brought electronic music to festival
        stages worldwide. Their spectacular live shows and inventive production have kept them at the forefront of dance music 
        for decades.`,
      imageUrl: null,       // or a link to an image
      genre: "Electronic",  // must match one of your genre names exactly
    },
    {
      name: "Björk",
      description: `Björk is an Icelandic singer, songwriter, and producer known for her otherworldly voice and fearless
       experimentation. Blending electronic, pop, classical, and avant-garde sounds, she has constantly reinvented herself
        across albums and visual art. Her boundary-pushing creativity has made her one of the most original artists in modern
         music.`,
      imageUrl: null,       // or a link to an image
      genre: "Electronic",  // must match one of your genre names exactly
    },
  ];

    for (const artist of artists) {
    await prisma.artist.upsert({
      where: { name: artist.name },
      update: {},
      create: {
        name: artist.name,
        description: artist.description.replace(/\s+/g, " ").trim(),
        imageUrl: artist.imageUrl,
        genre: artist.genre ? { connect: { name: artist.genre } } : undefined,
      },
    });
  }

  // ------PRODUCTS------
  // ----- Products (vinyl) -----
  // Prices are in TL. serialNumber uses our own store format (VS-LP-###).
  // Out of stock on purpose (for testing req. 7): VS-LP-004, VS-LP-037
  const products = [
    // ── Jazz ──
    {
      name: "In the Wee Small Hours",
      artist: "Frank Sinatra",
      genre: "Jazz",
      model: "180g Remastered Reissue",
      serialNumber: "VS-LP-001",
      quantity: 12,
      price: 1450.0,
      cost: 700.0,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Capitol Records",
      description: `Released in 1955, this is Sinatra's late-night album of ballads about loneliness
        and lost love, arranged by Nelson Riddle. It is often called one of the first concept albums.`,
    },
    {
      name: "Come Fly with Me",
      artist: "Frank Sinatra",
      genre: "Jazz",
      model: "180g Remastered Reissue",
      serialNumber: "VS-LP-002",
      quantity: 9,
      price: 1350.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Capitol Records",
      description: `A 1958 travel-themed album arranged by Billy May, full of upbeat swing songs
        about destinations around the world. Sinatra at his most playful and confident.`,
    },
    {
      name: "Satch Plays Fats",
      artist: "Louis Armstrong",
      genre: "Jazz",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-003",
      quantity: 6,
      price: 1250.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Columbia Records",
      description: `Armstrong and his All Stars pay tribute to Fats Waller on this 1955 album,
        including classics like "Ain't Misbehavin'" and "Honeysuckle Rose".`,
    },
    {
      name: "Hello, Dolly!",
      artist: "Louis Armstrong",
      genre: "Jazz",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-004",
      quantity: 0,
      price: 1150.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Kapp Records",
      description: `The 1964 album built around Armstrong's hit title song, which famously
        knocked the Beatles off the top of the US charts. Warm, joyful and full of charm.`,
    },
    {
      name: "Bewitched",
      artist: "Laufey",
      genre: "Jazz",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-005",
      quantity: 15,
      price: 1890.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "AWAL",
      description: `Laufey's 2023 second album blends vintage jazz with classical strings and
        bossa nova. It won the Grammy for Best Traditional Pop Vocal Album.`,
    },
    {
      name: "A Matter of Time",
      artist: "Laufey",
      genre: "Jazz",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-006",
      quantity: 14,
      price: 2150.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "AWAL",
      description: `Laufey's 2025 third album continues her mix of jazz, classical and pop,
        with lush arrangements and intimate songs about love and growing up.`,
    },

    // ── Rock ──
    {
      name: "L.A. Woman",
      artist: "The Doors",
      genre: "Rock",
      model: "180g Remastered Reissue",
      serialNumber: "VS-LP-007",
      quantity: 8,
      price: 1650.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Elektra Records",
      description: `The final Doors album recorded with Jim Morrison, released in 1971. A raw,
        bluesy record featuring the title track and "Riders on the Storm".`,
    },
    {
      name: "Morrison Hotel",
      artist: "The Doors",
      genre: "Rock",
      model: "180g Remastered Reissue",
      serialNumber: "VS-LP-008",
      quantity: 7,
      price: 1550.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Elektra Records",
      description: `The Doors' 1970 return to gritty blues rock, opening with the
        hard-driving "Roadhouse Blues".`,
    },
    {
      name: "Sheer Heart Attack",
      artist: "Queen",
      genre: "Rock",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-009",
      quantity: 10,
      price: 1750.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "EMI",
      description: `Queen's 1974 third album and their breakthrough, featuring the hit
        "Killer Queen". Bold, theatrical and full of stylistic surprises.`,
    },
    {
      name: "Innuendo",
      artist: "Queen",
      genre: "Rock",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-010",
      quantity: 6,
      price: 1850.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Parlophone",
      description: `Released in 1991, the last Queen album to come out during Freddie Mercury's
        lifetime. Ambitious and moving, it closes with "The Show Must Go On".`,
    },
    {
      name: "Led Zeppelin IV",
      artist: "Led Zeppelin",
      genre: "Rock",
      model: "180g Remastered Reissue",
      serialNumber: "VS-LP-011",
      quantity: 13,
      price: 1990.0,
      cost: 1000.0,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Atlantic Records",
      description: `The band's untitled 1971 fourth album, home to "Stairway to Heaven",
        "Black Dog" and "When the Levee Breaks". One of the best-selling rock records ever.`,
    },
    {
      name: "Led Zeppelin II",
      artist: "Led Zeppelin",
      genre: "Rock",
      model: "180g Remastered Reissue",
      serialNumber: "VS-LP-012",
      quantity: 9,
      price: 1890.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Atlantic Records",
      description: `Heavy blues riffs and thunderous drums define this 1969 album, which opens
        with "Whole Lotta Love" and helped lay the groundwork for hard rock.`,
    },
    {
      name: "Elvis Is Back!",
      artist: "Elvis Presley",
      genre: "Rock",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-013",
      quantity: 5,
      price: 1290.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "RCA Victor",
      description: `Elvis's first album after his army service, released in 1960. A confident
        mix of rock, blues and pop, including "Fever" and "Reconsider Baby".`,
    },
    {
      name: "How Great Thou Art",
      artist: "Elvis Presley",
      genre: "Rock",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-014",
      quantity: 4,
      price: 1090.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "RCA Victor",
      description: `Elvis's 1967 gospel album, a heartfelt showcase of his voice that won him
        a Grammy for Best Sacred Performance.`,
    },
    {
      name: "The Dark Side of the Moon",
      artist: "Pink Floyd",
      genre: "Rock",
      model: "180g Remastered Reissue",
      serialNumber: "VS-LP-015",
      quantity: 18,
      price: 2290.0,
      cost: 1150.0,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Harvest Records",
      description: `The 1973 landmark exploring time, money and madness, wrapped in the famous
        prism cover. One of the best-selling albums in history.`,
    },
    {
      name: "The Wall",
      artist: "Pink Floyd",
      genre: "Rock",
      model: "2LP Gatefold Reissue",
      serialNumber: "VS-LP-016",
      quantity: 7,
      price: 3290.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Harvest Records",
      description: `A 1979 double-album rock opera about isolation, featuring "Another Brick in
        the Wall, Part 2" and "Comfortably Numb".`,
    },

    // ── Pop ──
    {
      name: "1989",
      artist: "Taylor Swift",
      genre: "Pop",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-017",
      quantity: 20,
      price: 1990.0,
      cost: 950.0,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Big Machine Records",
      description: `Taylor Swift's 2014 full move into synth-pop, with hits like "Shake It Off"
        and "Blank Space". It won the Grammy for Album of the Year.`,
    },
    {
      name: "Folklore",
      artist: "Taylor Swift",
      genre: "Pop",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-018",
      quantity: 16,
      price: 2390.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Republic Records",
      description: `A quiet, story-driven indie-folk album made in 2020 with Aaron Dessner and
        Jack Antonoff. It won the Grammy for Album of the Year.`,
    },
    {
      name: "After Hours",
      artist: "The Weeknd",
      genre: "Pop",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-019",
      quantity: 11,
      price: 2190.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "XO / Republic Records",
      description: `The Weeknd's 2020 album draws on 1980s synth-pop and features the massive
        hit "Blinding Lights". Dark, cinematic and glossy.`,
    },
    {
      name: "Starboy",
      artist: "The Weeknd",
      genre: "Pop",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-020",
      quantity: 10,
      price: 2290.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "XO / Republic Records",
      description: `A 2016 album of sleek pop and R&B, with a title track made with Daft Punk.
        It won the Grammy for Best Urban Contemporary Album.`,
    },
    {
      name: "The Rise and Fall of a Midwest Princess",
      artist: "Chappell Roan",
      genre: "Pop",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-021",
      quantity: 17,
      price: 2490.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Amusement / Island Records",
      description: `Chappell Roan's 2023 debut album, produced with Dan Nigro. Big, campy synth-pop
        anthems like "Pink Pony Club" and "HOT TO GO!" sit next to heartfelt ballads.`,
    },

    // ── Classical ──
    {
      name: "Beethoven: The 9 Symphonies (Karajan, 1962–1963)",
      artist: "Beethoven",
      genre: "Classical",
      model: "Box Set Reissue",
      serialNumber: "VS-LP-022",
      quantity: 3,
      price: 4890.0,
      cost: 2600.0,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Deutsche Grammophon",
      description: `Herbert von Karajan and the Berlin Philharmonic's complete cycle of
        Beethoven's nine symphonies, recorded in 1962–1963 and still one of the most famous sets.`,
    },
    {
      name: "The Nutcracker, Op. 71",
      artist: "Tchaikovsky",
      genre: "Classical",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-023",
      quantity: 8,
      price: 1690.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Deutsche Grammophon",
      description: `Tchaikovsky's 1892 holiday ballet, home to the "Dance of the Sugar Plum Fairy"
        and its famous celesta melody.`,
    },
    {
      name: "Swan Lake, Op. 20",
      artist: "Tchaikovsky",
      genre: "Classical",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-024",
      quantity: 7,
      price: 1590.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Deutsche Grammophon",
      description: `Tchaikovsky's first ballet, premiered in 1877. A sweeping, tragic love story
        and one of the most performed ballets in the world.`,
    },
    {
      name: "The Sleeping Beauty, Op. 66",
      artist: "Tchaikovsky",
      genre: "Classical",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-025",
      quantity: 5,
      price: 1590.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Deutsche Grammophon",
      description: `Based on Perrault's fairy tale and premiered in 1890, this grand ballet score
        is full of elegant waltzes and rich orchestral color.`,
    },
    {
      name: "The Four Seasons (Nigel Kennedy & English Chamber Orchestra)",
      artist: "Vivaldi",
      genre: "Classical",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-026",
      quantity: 9,
      price: 1390.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "EMI Classics",
      description: `Nigel Kennedy's energetic 1989 recording of Vivaldi's violin concertos,
        which became one of the best-selling classical albums of all time.`,
    },
    {
      name: "The Four Seasons (Trevor Pinnock & The English Concert)",
      artist: "Vivaldi",
      genre: "Classical",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-027",
      quantity: 6,
      price: 1490.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Archiv Produktion",
      description: `A 1981 period-instrument recording that brings out the bright, lively
        textures of Vivaldi's original Baroque sound.`,
    },

    // ── Hip-Hop/Rap ──
    {
      name: "The Eminem Show",
      artist: "Eminem",
      genre: "Hip-Hop/Rap",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-028",
      quantity: 12,
      price: 2190.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Aftermath / Interscope Records",
      description: `Eminem's 2002 album, largely self-produced, featuring "Without Me" and
        "Cleanin' Out My Closet". Sharp, personal and full of energy.`,
    },
    {
      name: "The Marshall Mathers LP",
      artist: "Eminem",
      genre: "Hip-Hop/Rap",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-029",
      quantity: 10,
      price: 2090.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Aftermath / Interscope Records",
      description: `The 2000 album with "The Real Slim Shady" and "Stan". It won the Grammy for
        Best Rap Album and became one of the fastest-selling rap records ever.`,
    },
    {
      name: "Take Care",
      artist: "Drake",
      genre: "Hip-Hop/Rap",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-030",
      quantity: 11,
      price: 2390.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Young Money / Cash Money / Republic",
      description: `Drake's moody 2011 album blending rap and R&B, shaped by Noah "40" Shebib's
        atmospheric production. It won the Grammy for Best Rap Album.`,
    },
    {
      name: "Nothing Was the Same",
      artist: "Drake",
      genre: "Hip-Hop/Rap",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-031",
      quantity: 8,
      price: 1990.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Young Money / Cash Money / Republic",
      description: `A 2013 album about ambition and fame, featuring "Started from the Bottom"
        and "Hold On, We're Going Home".`,
    },
    {
      name: "good kid, m.A.A.d city",
      artist: "Kendrick Lamar",
      genre: "Hip-Hop/Rap",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-032",
      quantity: 13,
      price: 2290.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Top Dawg / Aftermath / Interscope",
      description: `Kendrick Lamar's 2012 concept album about growing up in Compton, told like
        a film. Includes "Swimming Pools" and "Money Trees".`,
    },
    {
      name: "DAMN.",
      artist: "Kendrick Lamar",
      genre: "Hip-Hop/Rap",
      model: "Standard Black Vinyl",
      serialNumber: "VS-LP-033",
      quantity: 12,
      price: 2090.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Top Dawg / Aftermath / Interscope",
      description: `The 2017 album featuring "HUMBLE." and "DNA.", which made Kendrick the first
        non-classical, non-jazz artist to win the Pulitzer Prize for Music.`,
    },

    // ── Electronic ──
    {
      name: "Discovery",
      artist: "Daft Punk",
      genre: "Electronic",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-034",
      quantity: 14,
      price: 2390.0,
      cost: 1200.0,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Virgin Records",
      description: `Daft Punk's 2001 album of joyful, disco-flavored house, including
        "One More Time" and "Digital Love".`,
    },
    {
      name: "Random Access Memories",
      artist: "Daft Punk",
      genre: "Electronic",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-035",
      quantity: 10,
      price: 2690.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Columbia Records",
      description: `A 2013 love letter to live-played funk and disco, featuring "Get Lucky"
        with Pharrell Williams and Nile Rodgers. It won the Grammy for Album of the Year.`,
    },
    {
      name: "Dig Your Own Hole",
      artist: "The Chemical Brothers",
      genre: "Electronic",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-036",
      quantity: 6,
      price: 1790.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Virgin Records",
      description: `The 1997 big-beat classic with "Block Rockin' Beats" and "Setting Sun",
        a collaboration with Noel Gallagher.`,
    },
    {
      name: "Surrender",
      artist: "The Chemical Brothers",
      genre: "Electronic",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-037",
      quantity: 0,
      price: 1790.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "Virgin Records",
      description: `A 1999 album of euphoric dance tracks, led by the anthem
        "Hey Boy Hey Girl".`,
    },
    {
      name: "Homogenic",
      artist: "Björk",
      genre: "Electronic",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-038",
      quantity: 7,
      price: 1690.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "One Little Indian",
      description: `Björk's 1997 album pairing sweeping strings with harsh electronic beats,
        including "Jóga" and "Bachelorette".`,
    },
    {
      name: "Post",
      artist: "Björk",
      genre: "Electronic",
      model: "180g Vinyl Reissue",
      serialNumber: "VS-LP-039",
      quantity: 8,
      price: 1690.0,
      cost: null,
      warrantyStatus: "Covered against manufacturing defects",
      distributor: "One Little Indian",
      description: `A playful and eclectic 1995 album, ranging from the menacing "Army of Me"
        to "Hyperballad" and the big-band burst of "It's Oh So Quiet".`,
    },
    // ── Record Players ──
    {
      name: "Classic Belt-Drive Turntable",
      category: "Record Player",
      model: "BD-100",
      serialNumber: "VS-TT-001",
      quantity: 6,
      price: 8990.0,
      cost: 5200.0,
      warrantyStatus: "2-year manufacturer warranty",
      distributor: "Vinyl Store Audio",
      description: `An easy-to-use belt-drive turntable with a built-in phono preamp, so it
        plugs straight into powered speakers. Plays 33 and 45 RPM records.`,
    },
    {
      name: "Bluetooth Turntable",
      category: "Record Player",
      model: "BT-200",
      serialNumber: "VS-TT-002",
      quantity: 9,
      price: 6490.0,
      cost: null,
      warrantyStatus: "2-year manufacturer warranty",
      distributor: "Vinyl Store Audio",
      description: `A modern turntable that streams your records wirelessly to Bluetooth
        speakers or headphones. Includes a dust cover and built-in preamp.`,
    },
    {
      name: "Direct-Drive DJ Turntable",
      category: "Record Player",
      model: "DD-300",
      serialNumber: "VS-TT-003",
      quantity: 3,
      price: 14990.0,
      cost: null,
      warrantyStatus: "2-year manufacturer warranty",
      distributor: "Vinyl Store Audio",
      description: `A sturdy direct-drive turntable with fast start-up, adjustable pitch and
        stable speed, built for DJs and serious listeners.`,
    },

    // ── Accessories ──
    {
      name: "Record Cleaning Kit",
      category: "Accessory",
      model: "CK-1",
      serialNumber: "VS-AC-001",
      quantity: 25,
      price: 590.0,
      cost: null,
      warrantyStatus: "No warranty",
      distributor: "Vinyl Store Audio",
      description: `A velvet brush and cleaning solution that remove dust and fingerprints,
        keeping your records sounding clear and lasting longer.`,
    },
    {
      name: "Anti-Static Inner Sleeves (50 pack)",
      category: "Accessory",
      model: "IS-50",
      serialNumber: "VS-AC-002",
      quantity: 40,
      price: 390.0,
      cost: 150.0,
      warrantyStatus: "No warranty",
      distributor: "Vinyl Store Audio",
      description: `Soft anti-static sleeves that protect records from scratches and dust.
        Fits standard 12-inch LPs.`,
    },
    {
      name: "Replacement Stylus",
      category: "Accessory",
      model: "ST-2",
      serialNumber: "VS-AC-003",
      quantity: 0,
      price: 990.0,
      cost: null,
      warrantyStatus: "6-month warranty",
      distributor: "Vinyl Store Audio",
      description: `A replacement diamond stylus that restores clear sound to a worn needle.
        Fits our Classic and Bluetooth turntables.`,
    },
  ];

// Check that every product's artist exists
  for (const p of products) {
    if (p.artist) {
      const found = await prisma.artist.findUnique({ where: { name: p.artist } });
      if (!found) console.log(`Missing artist: "${p.artist}" (product: ${p.name})`);
    }
  }

   for (const p of products) {
    await prisma.product.upsert({
      where: { serialNumber: p.serialNumber },
      update: {},
      create: {
        name: p.name,
        model: p.model,
        serialNumber: p.serialNumber,
        quantity: p.quantity,
        price: p.price,
        cost: p.cost,
        warrantyStatus: p.warrantyStatus,
        distributor: p.distributor,
        description: p.description.replace(/\s+/g, " ").trim(),
        imageUrl: null, // covers added later
        category: { connect: { name: p.category ?? "Vinyl" } },
        artist: p.artist ? { connect: { name: p.artist } } : undefined,
        genre: p.genre ? { connect: { name: p.genre } } : undefined,
      },
    });
  }


    // ----- Test users (one per role) -----
  const testPassword = "Test1234!";

  const users = [
    { name: "Test Customer", lastname: "1",        email: "customer@vinylstore.test", role: "CUSTOMER",
      taxId: "11111111111", homeAddress: "Test Street 1, Istanbul" },
    { name: "Test Sales Manager",lastname: "1",    email: "sales@vinylstore.test",    role: "SALES_MANAGER" },
    { name: "Test Product Manager",lastname: "1",  email: "product@vinylstore.test",  role: "PRODUCT_MANAGER" },
    { name: "Test Support Agent",lastname: "1",    email: "support@vinylstore.test",  role: "SUPPORT_AGENT" },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(testPassword, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        lastname: u.lastname,
        email: u.email,
        passwordHash,
        role: u.role,
        taxId: u.taxId,
        homeAddress: u.homeAddress,
      },
    });
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });