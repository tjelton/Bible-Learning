// Key events in the Gospel of John. Same shape as matthew.js; see the notes there.
window.GOSPELS = window.GOSPELS || {};
window.GOSPELS.John = {
  book: "John",
  chapters: 21,
  intro: "John is built around signs (miracles that point to who Jesus is) and “I am” sayings. Chapters 1–12 are often called the Book of Signs, and chapters 13–21 the Book of Glory. Five whole chapters (13–17) happen on the night before Jesus dies. John says he wrote so that you may believe that Jesus is the Christ (20:31).",
  markNote: "part of Jesus’ farewell to his disciples at the Last Supper",
  markTag: "Farewell",
  sections: [
    { from: 1, to: 1, name: "The Word and the first disciples" },
    { from: 2, to: 4, name: "The first signs" },
    { from: 5, to: 10, name: "Signs and conflict at the feasts" },
    { from: 11, to: 12, name: "Lazarus and the coming hour" },
    { from: 13, to: 17, name: "The Last Supper and farewell", mark: true },
    { from: 18, to: 19, name: "Arrest, trial and crucifixion" },
    { from: 20, to: 21, name: "Resurrection" },
  ],
  events: [
    // ── Chapter 1 ──
    { id: "jn-word", title: "The Word became flesh", ch: 1, v: [1, 18], key: 14,
      clue: "The book opens before creation: in the beginning was the Word, and the Word was with God, and the Word was God. The light shines in the darkness, and the darkness hasn’t overcome it. A man sent from God, named John, comes to testify about the light.",
      par: [] },
    { id: "jn-lamb-of-god", title: "“Behold, the Lamb of God!”", ch: 1, v: [19, 34], key: 29,
      clue: "Priests and Levites from Jerusalem ask John who he is; he says he is not the Christ but the voice of one crying in the wilderness. The next day, seeing Jesus coming, he says, ‘Behold, the Lamb of God, who takes away the sin of the world!’",
      par: ["Matthew 3", "Mark 1", "Luke 3"] },
    { id: "jn-come-and-see", title: "“Come and see”", ch: 1, v: [35, 51], key: 46,
      clue: "Two of John’s disciples follow Jesus, and Andrew brings his brother Simon, whom Jesus names Cephas. Philip tells Nathanael they have found the one Moses wrote about, from Nazareth. ‘Can any good thing come out of Nazareth?’",
      par: [] },

    // ── Chapter 2 ──
    { id: "jn-cana", title: "Water into wine at Cana", ch: 2, v: [1, 12], key: 11,
      clue: "At a wedding in Cana of Galilee the wine runs out. Jesus’ mother tells the servants to do whatever he says. He has them fill six stone water jars, and the ruler of the feast tastes the water that has become wine: ‘You have kept the good wine until now!’",
      par: [], confuse: [4] },
    { id: "jn-temple", title: "“Destroy this temple”", ch: 2, v: [13, 22], key: 19,
      clue: "At Passover in Jerusalem, Jesus makes a whip of cords and drives the merchants and money changers out of the temple. Asked for a sign, he says, ‘Destroy this temple, and in three days I will raise it up’; he means the temple of his body.",
      par: ["Matthew 21", "Mark 11", "Luke 19"] },

    // ── Chapter 3 ──
    { id: "jn-nicodemus", title: "Nicodemus comes by night", ch: 3, v: [1, 21], key: 16,
      clue: "A Pharisee and ruler of the Jews named Nicodemus comes to Jesus by night. Jesus tells him that unless one is born anew he can’t see God’s Kingdom, and that as Moses lifted up the serpent in the wilderness, the Son of Man must be lifted up.",
      par: [] },
    { id: "jn-must-decrease", title: "“He must increase”", ch: 3, v: [22, 36], key: 30,
      clue: "John’s disciples tell him that everyone is now going to Jesus. John says he is not the Christ but the friend of the bridegroom, who rejoices greatly at the bridegroom’s voice: ‘He must increase, but I must decrease.’",
      par: [] },

    // ── Chapter 4 ──
    { id: "jn-samaritan-woman", title: "The woman at the well", ch: 4, v: [1, 42], key: 14,
      clue: "Tired from his journey, Jesus sits by Jacob’s well in Samaria and asks a woman for a drink. He offers her living water, tells her she has had five husbands, and says true worshipers will worship the Father in spirit and truth.",
      par: [], confuse: [7] },
    { id: "jn-officials-son", title: "“Go your way. Your son lives”", ch: 4, v: [46, 54], key: 50,
      clue: "Back in Cana, a nobleman whose son is sick at Capernaum begs Jesus to come before the child dies. Jesus says, ‘Go your way. Your son lives.’ On the way home his servants tell him the fever left at the seventh hour, the very hour Jesus spoke.",
      par: [], confuse: [2] },

    // ── Chapter 5 ──
    { id: "jn-bethesda", title: "The pool of Bethesda", ch: 5, v: [1, 18], key: 8,
      clue: "At a pool by the sheep gate in Jerusalem, Jesus asks a man who has been sick for thirty-eight years, ‘Do you want to be made well?’ He tells him to take up his mat and walk, and because it is the Sabbath, the Jewish leaders persecute Jesus.",
      par: [], confuse: [9] },
    { id: "jn-search-scriptures", title: "“You search the Scriptures”", ch: 5, v: [19, 47], key: 39,
      clue: "Jesus says the Son can do nothing by himself but what he sees the Father doing. He points to the testimony of John, of his works, of the Father and of the Scriptures, and says that Moses wrote about him.",
      par: [] },

    // ── Chapter 6 ──
    { id: "jn-feed-5000", title: "Five barley loaves", ch: 6, v: [1, 15], key: 9,
      clue: "Jesus asks Philip where they can buy bread for the great crowd. Andrew points out a boy with five barley loaves and two fish. After everyone is fed, the people want to take Jesus by force to make him king, so he withdraws to the mountain alone.",
      par: ["Matthew 14", "Mark 6", "Luke 9"] },
    { id: "jn-walk-water", title: "Walking on the sea to Capernaum", ch: 6, v: [16, 21], key: 20,
      clue: "In the evening the disciples set out by boat toward Capernaum. A great wind is blowing, and after rowing about twenty-five or thirty stadia they see Jesus walking on the sea and are afraid, but he says, ‘It is I. Don’t be afraid.’",
      par: ["Matthew 14", "Mark 6"] },
    { id: "jn-bread-of-life", title: "“I am the bread of life”", ch: 6, v: [22, 59], key: 35,
      clue: "The crowd finds Jesus in Capernaum and recalls the manna their fathers ate in the wilderness. Jesus says he is the bread of life; whoever comes to him won’t be hungry, and whoever eats his flesh and drinks his blood has eternal life.",
      par: [] },
    { id: "jn-words-of-life", title: "“To whom would we go?”", ch: 6, v: [60, 71], key: 68,
      clue: "Many disciples call this a hard saying and stop following Jesus. He asks the Twelve whether they want to go away too. Simon Peter answers, ‘Lord, to whom would we go? You have the words of eternal life.’",
      par: [] },

    // ── Chapter 7 ──
    { id: "jn-brothers-unbelief", title: "Even his brothers didn’t believe", ch: 7, v: [1, 13], key: 5,
      clue: "With the Feast of Booths near, Jesus’ brothers urge him to go to Judea and show himself to the world, for even his brothers don’t believe in him. He says his time hasn’t yet come, but later goes up to the feast in secret.",
      par: [] },
    { id: "jn-living-water", title: "“If anyone is thirsty”", ch: 7, v: [37, 52], key: 37,
      clue: "On the last and greatest day of the feast, Jesus stands and cries out that anyone who is thirsty should come to him and drink. The crowd is divided, and officers sent to arrest him come back saying, ‘No man ever spoke like this man!’",
      par: [], confuse: [4] },

    // ── Chapter 8 ──
    { id: "jn-first-stone", title: "The first stone", ch: 8, v: [1, 11], key: 7,
      clue: "At dawn in the temple, scribes and Pharisees bring a woman caught in adultery and ask whether she should be stoned as Moses commanded. Jesus stoops and writes on the ground with his finger, then says the one without sin should throw the first stone.",
      par: [],
      note: "This account (John 7:53–8:11) isn’t in the earliest manuscripts of John. Most Bibles print it with a note." },
    { id: "jn-light-of-world", title: "“I am the light of the world”", ch: 8, v: [12, 30], key: 12,
      clue: "Jesus says that he is the light of the world and whoever follows him won’t walk in darkness. The Pharisees object that he is testifying about himself, so his testimony isn’t valid.",
      par: [], confuse: [9] },
    { id: "jn-before-abraham", title: "“Before Abraham came into existence, I AM”", ch: 8, v: [31, 59], key: 58,
      clue: "Jesus says the truth will make his followers free. His hearers protest that they are Abraham’s offspring and have never been in bondage. The argument ends with a claim about Abraham, and they pick up stones to throw at him.",
      par: [] },

    // ── Chapter 9 ──
    { id: "jn-born-blind", title: "The man born blind", ch: 9, v: [1, 41], key: 25,
      clue: "The disciples ask who sinned, this man or his parents, that he was born blind. Jesus makes mud with his saliva, anoints his eyes, and sends him to wash in the pool of Siloam. Questioned by the Pharisees, the man says, ‘Though I was blind, now I see.’",
      par: [], confuse: [5] },

    // ── Chapter 10 ──
    { id: "jn-good-shepherd", title: "“I am the good shepherd”", ch: 10, v: [1, 21], key: 11,
      clue: "The sheep hear the shepherd’s voice and follow him, but flee from a stranger. Jesus says he is the door of the sheep, and the good shepherd who lays down his life for the sheep. He has other sheep, not of this fold.",
      par: [] },
    { id: "jn-one-with-father", title: "“I and the Father are one”", ch: 10, v: [22, 42], key: 30,
      clue: "At the Feast of the Dedication, in winter, Jesus walks in Solomon’s porch. Asked to say plainly whether he is the Christ, he says his sheep hear his voice and no one will snatch them out of his hand. They take up stones again.",
      par: [] },

    // ── Chapter 11 ──
    { id: "jn-lazarus", title: "“Lazarus, come out!”", ch: 11, v: [1, 44], key: 25,
      clue: "Lazarus of Bethany, the brother of Mary and Martha, is sick, but Jesus stays where he is two more days. When he arrives, Lazarus has been in the tomb four days. Jesus weeps, has the stone taken away, and cries out, ‘Lazarus, come out!’",
      par: [] },
    { id: "jn-caiaphas", title: "One man should die for the people", ch: 11, v: [45, 57], key: 50,
      clue: "After this sign, the chief priests and Pharisees gather a council, afraid the Romans will take away their nation. Caiaphas, high priest that year, says it is better for one man to die for the people, and from that day they plan to kill Jesus.",
      par: ["Matthew 26", "Mark 14", "Luke 22"] },

    // ── Chapter 12 ──
    { id: "jn-mary-anoints", title: "Mary anoints his feet", ch: 12, v: [1, 11], key: 3,
      clue: "Six days before the Passover, at a dinner in Bethany with Lazarus at the table, Mary anoints Jesus’ feet with a pound of very precious ointment of pure nard and wipes them with her hair. Judas Iscariot says it should have been sold for the poor.",
      par: ["Matthew 26", "Mark 14"] },
    { id: "jn-palm-branches", title: "Branches of palm trees", ch: 12, v: [12, 19], key: 13,
      clue: "The great crowd that has come to the feast takes branches of palm trees and goes out to meet Jesus, crying ‘Hosanna!’ He finds a young donkey and sits on it, and the Pharisees say, ‘Look, the world has gone after him.’",
      par: ["Matthew 21", "Mark 11", "Luke 19"] },
    { id: "jn-grain-of-wheat", title: "A grain of wheat", ch: 12, v: [20, 36], key: 24,
      clue: "Some Greeks tell Philip they want to see Jesus. Jesus says the hour has come for the Son of Man to be glorified: unless a grain of wheat falls into the earth and dies, it remains alone, but if it dies, it bears much fruit.",
      par: [] },

    // ── Chapter 13 ──
    { id: "jn-washes-feet", title: "Jesus washes the disciples’ feet", ch: 13, v: [1, 20], key: 14,
      clue: "Knowing his hour has come, Jesus rises from supper, wraps a towel around his waist and washes the disciples’ feet. Peter protests, ‘You will never wash my feet!’ Jesus says he has given them an example to follow.",
      par: [] },
    { id: "jn-and-it-was-night", title: "“And it was night”", ch: 13, v: [21, 30], key: 26,
      clue: "Troubled in spirit, Jesus says one of them will betray him. The disciple Jesus loves, leaning against his chest, asks who it is. Jesus dips a piece of bread and gives it to Judas, who goes out immediately into the night.",
      par: ["Matthew 26", "Mark 14", "Luke 22"] },
    { id: "jn-new-commandment", title: "A new commandment", ch: 13, v: [31, 38], key: 34,
      clue: "After Judas leaves, Jesus gives his disciples a new commandment: love one another as he has loved them, and by this everyone will know they are his disciples. When Peter vows to lay down his life for him, Jesus foretells his denial.",
      par: ["Matthew 26", "Mark 14", "Luke 22"], confuse: [15] },

    // ── Chapter 14 ──
    { id: "jn-the-way", title: "“I am the way, the truth, and the life”", ch: 14, v: [1, 14], key: 6,
      clue: "‘Don’t let your heart be troubled. In my Father’s house are many homes.’ When Thomas says they don’t know the way, Jesus answers with one of his best-known ‘I am’ sayings. Then Philip asks him to show them the Father.",
      par: [] },
    { id: "jn-peace-i-leave", title: "“Peace I leave with you”", ch: 14, v: [15, 31], key: 27,
      clue: "Jesus promises that the Father will send another Counselor, the Spirit of truth, to be with them forever. He won’t leave them orphans. ‘Peace I leave with you. My peace I give to you; not as the world gives.’",
      par: [], confuse: [16] },

    // ── Chapter 15 ──
    { id: "jn-true-vine", title: "“I am the true vine”", ch: 15, v: [1, 17], key: 5,
      clue: "Jesus says he is the true vine and his Father is the farmer, who prunes every branch that bears fruit. Apart from him they can do nothing. No one has greater love than to lay down his life for his friends.",
      par: [], confuse: [13] },
    { id: "jn-world-hates", title: "If the world hates you", ch: 15, v: [18, 27], key: 18,
      clue: "If the world hates you, know that it hated me before it hated you. A servant isn’t greater than his lord; if they persecuted me, they will persecute you too. When the Counselor comes, he will testify about me.",
      par: [], confuse: [16] },

    // ── Chapter 16 ──
    { id: "jn-into-all-truth", title: "He will guide you into all truth", ch: 16, v: [1, 15], key: 13,
      clue: "Jesus warns his disciples that they will be put out of the synagogues. It is to their advantage that he goes away, for then the Counselor will come, convict the world about sin, righteousness and judgment, and guide them into all truth.",
      par: [], confuse: [14, 15] },
    { id: "jn-overcome-world", title: "“I have overcome the world”", ch: 16, v: [16, 33], key: 33,
      clue: "‘A little while, and you will not see me.’ Jesus compares their grief to a woman in labor, whose sorrow turns to joy when the child is born. He ends: in the world you have oppression, but cheer up, for he has overcome the world.",
      par: [] },

    // ── Chapter 17 ──
    { id: "jn-that-they-may-be-one", title: "“That they may all be one”", ch: 17, v: [1, 26], key: 21,
      clue: "Lifting up his eyes to heaven, Jesus prays: ‘Father, the time has come. Glorify your Son.’ He prays for his disciples, that the Father will keep them, and for all who will believe through their word, that they may all be one.",
      par: [] },

    // ── Chapter 18 ──
    { id: "jn-malchus", title: "Malchus’ ear", ch: 18, v: [1, 11], key: 10,
      clue: "In a garden across the brook Kidron, Judas arrives with soldiers carrying lanterns, torches and weapons. When Jesus says ‘I am he,’ they draw back and fall to the ground. Simon Peter cuts off the right ear of the high priest’s servant.",
      par: ["Matthew 26", "Mark 14", "Luke 22"] },
    { id: "jn-annas-denials", title: "Before Annas; Peter at the fire", ch: 18, v: [12, 27], key: 17,
      clue: "Jesus is taken first to Annas, the father-in-law of Caiaphas. Peter stands warming himself at a fire of coals in the courtyard and denies being his disciple, and a relative of the man whose ear he cut off asks, ‘Didn’t I see you in the garden?’",
      par: ["Matthew 26", "Mark 14", "Luke 22"] },
    { id: "jn-what-is-truth", title: "“What is truth?”", ch: 18, v: [28, 40], key: 38,
      clue: "The Jewish leaders won’t enter the Praetorium, so they won’t be defiled before the Passover. Jesus tells Pilate, ‘My Kingdom is not of this world,’ and that he came to testify to the truth. Pilate replies with a question.",
      par: ["Matthew 27", "Mark 15", "Luke 23"] },

    // ── Chapter 19 ──
    { id: "jn-behold-the-man", title: "“Behold, the man!”", ch: 19, v: [1, 16], key: 5,
      clue: "Pilate has Jesus flogged, and the soldiers dress him in a crown of thorns and a purple garment. Pilate brings him out to the crowd. The chief priests cry, ‘We have no king but Caesar!’ and Pilate hands him over at the place called The Pavement.",
      par: ["Matthew 27", "Mark 15"] },
    { id: "jn-woman-behold-son", title: "“Woman, behold your son!”", ch: 19, v: [17, 27], key: 26,
      clue: "Jesus carries his own cross to Golgotha. Pilate’s title, written in Hebrew, Latin and Greek, reads ‘JESUS OF NAZARETH, THE KING OF THE JEWS.’ The soldiers cast lots for his seamless tunic, and Jesus entrusts his mother to the disciple he loves.",
      par: ["Matthew 27", "Mark 15", "Luke 23"] },
    { id: "jn-it-is-finished", title: "“It is finished”", ch: 19, v: [28, 37], key: 30,
      clue: "Knowing that all things are finished, Jesus says, ‘I am thirsty,’ and receives vinegar on hyssop. He bows his head and gives up his spirit. The soldiers don’t break his legs, but one pierces his side, and blood and water come out.",
      par: ["Matthew 27", "Mark 15", "Luke 23"] },
    { id: "jn-nicodemus-myrrh", title: "A hundred pounds of myrrh and aloes", ch: 19, v: [38, 42], key: 39,
      clue: "Joseph of Arimathaea, a secret disciple, asks Pilate for the body. Nicodemus brings a mixture of myrrh and aloes, about a hundred pounds, and they bind the body in linen with the spices and lay it in a new tomb in a garden.",
      par: ["Matthew 27", "Mark 15", "Luke 23"] },

    // ── Chapter 20 ──
    { id: "jn-race-to-tomb", title: "Running to the tomb", ch: 20, v: [1, 10], key: 4,
      clue: "While it is still dark, Mary Magdalene finds the stone taken away and runs to Peter and the other disciple. They both run to the tomb; the other disciple outruns Peter, and they see the linen cloths lying there and the head cloth rolled up by itself.",
      par: ["Matthew 28", "Mark 16", "Luke 24"] },
    { id: "jn-rabboni", title: "“Rabboni!”", ch: 20, v: [11, 18], key: 16,
      clue: "Mary Magdalene stands weeping outside the tomb and sees Jesus, but thinks he is the gardener. When he says her name, she turns and calls him Teacher. She goes and tells the disciples, ‘I have seen the Lord!’",
      par: ["Mark 16"] },
    { id: "jn-thomas", title: "“My Lord and my God!”", ch: 20, v: [19, 29], key: 28,
      clue: "Jesus comes through locked doors, shows the disciples his hands and side, and breathes on them: ‘Receive the Holy Spirit!’ Thomas, who wasn’t there, won’t believe unless he touches the nail marks. Eight days later Jesus invites him to.",
      par: ["Luke 24"] },
    { id: "jn-that-you-may-believe", title: "Why this book was written", ch: 20, v: [30, 31], key: 31,
      clue: "The writer says Jesus did many other signs that aren’t written in this book, but these are written so that you may believe that Jesus is the Christ, the Son of God, and that believing you may have life in his name.",
      par: [] },

    // ── Chapter 21 ──
    { id: "jn-153-fish", title: "153 fish", ch: 21, v: [1, 14], key: 11,
      clue: "By the Sea of Tiberias, Peter and six others fish all night and catch nothing. At dawn a man on the beach tells them to cast the net on the right side of the boat. They haul in a net full of large fish, and Jesus has breakfast ready over a fire of coals.",
      par: [] },
    { id: "jn-feed-my-sheep", title: "“Do you love me?”", ch: 21, v: [15, 19], key: 17,
      clue: "After breakfast, Jesus asks Simon son of Jonah three times whether he loves him. Grieved at the third time, Peter says, ‘Lord, you know everything. You know that I have affection for you.’ Jesus tells him to feed his sheep, then hints at how Peter will die.",
      par: [] },
  ],
};
