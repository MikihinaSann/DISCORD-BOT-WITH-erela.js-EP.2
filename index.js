const { Client } = require("discord.js");
const { Manager } = require("erela.js");
const { token, nodes } = require("./config");

const client = new Client({
    intents: [129]
})

client.on("ready", () => {
    console.log("I am ready")
    client.manager.init(client.user.id);
    client.application.commands.set([
        {
            name: "play",
            description: "คำสั่งเล่นเพลง",
            options: [{
                name: "url",
                description: "ลิ้งค์เพลง",
                type: "STRING",
                required: true
            }]
        },
        {
            name: "skip",
            description: "ข้ามเพลง"
        },
        {
            name: "join",
            description: "เข้าห้องเสียง"
        },
        {
            name: "leave",
            description: "ออกห้องเสียง"
        },
        {
            name: "nowplaying",
            description: "ดูรายละเอียดของเพลงที่กำลังเล่น"
        },
        {
            name: "queue",
            description: "ดูรายละเอียดเพลงทั้งหมด"
        },
        {
            name: "loop",
            description: "คำสั่งวนเพลง",
            options: [
                {
                    name: "เลือกการวนเพลง",
                    description: "เลือกการวนเพลง",
                    type: "INTEGER",
                    choices: [
                        {
                            name: "loopqueue",
                            value: 0
                        },
                        {
                            name: "loopmusic",
                            value: 1
                        }
                    ],
                    required: true
                }
            ]
        },
        {
            name: "resume",
            description: "เล่นเพลงอีกครั้ง"
        }
    ])
})

client.on("raw", d => client.manager.updateVoiceState(d));

client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;

    if (interaction.isCommand()) {
        const namecmd = interaction.commandName;
        if (namecmd === "play") {
            const url = interaction.options.getString("url");

            let res;
            try {
                // Search for tracks using a query or url, using a query searches youtube automatically and the track requester object
                res = await client.manager.search(url, interaction.user);
                // Check the load type as this command is not that advanced for basics
                if (res.loadType === "LOAD_FAILED") throw res.exception;
                else if (res.loadType === "PLAYLIST_LOADED") throw { message: "Playlists are not supported with this command." };
            } catch (err) {
                return interaction.reply(`there was an error while searching: ${err.message}`);
            }

            const player = client.manager.create({
                guild: interaction.guildId,
                voiceChannel: interaction.member.voice.channel.id,
                textChannel: interaction.channel.id,
            });

            player.connect();
            player.queue.add(res.tracks[0]);

            if (!player.playing && !player.paused && !player.queue.size) player.play()

            return interaction.reply(`enqueuing ${res.tracks[0].title}.`)
        } else if (namecmd === "skip") {
            const { channel } = interaction.member.voice;

            const player = client.manager.get(interaction.guildId);

            if (!player || !player.queue.current) return interaction.reply({ content: "ขณะนี้ไม่มีเพลงที่กำลังเล่นอยู่" });

            if (!channel || channel.id != player.voiceChannel) return interaction.reply({ content: "คุณไม่ได้อยู่ในห้องเสียง" });

            player.stop();

            interaction.reply({ content: "ข้ามเพลงแล้ว!" })
        } else if (namecmd === "join") {
            const { channel } = interaction.member.voice;

            if (!channel) return interaction.reply({ content: "คุณไม่ได้อยู่ในห้องเสียง" });

            let player = client.manager.get(interaction.guildId);

            if (!player) {
                player = client.manager.create({
                    guild: interaction.guildId,
                    voiceChannel: interaction.member.voice.channel.id,
                    textChannel: interaction.channel.id,
                });
            } else {
                return interaction.reply({ content: "กรุณากลับเข้าห้องที่บอทอยู่" })
            }

            player.connect();

            interaction.reply({ content: "เข้าห้องแล้ว" })

        } else if (namecmd === "leave") {
            const { channel } = interaction.member.voice;

            if (!channel) return interaction.reply({ content: "คุณไม่ได้อยู่ในห้องเสียง" });

            let player = client.manager.get(interaction.guildId);

            if (!player) {
                return interaction.reply({ content: "ขณะนี้ไม่มีเพลงที่เล่น" })
            } else {
                player.destroy();
                interaction.reply({ content: "ออกห้องแล้ว" })
            }
        } else if (namecmd === "nowplaying") {
            const { channel } = interaction.member.voice;

            let player = client.manager.get(interaction.guildId);

            if (!player) return interaction.reply({ content: "ไม่มีเพลงที่เล่นอยู่" })

            if (channel.id != player.voiceChannel) return interaction.reply({ content: "คุณไม่ได้อยู่ห้องเดียวกับบอท" })

            if (!player.queue.current) return interaction.reply({ content: "ไม่มีเพลงที่เล่นอยู่" })

            const track = player.queue.current

            interaction.reply({
                embeds: [
                    {
                        author: {
                            name: client.user.username,
                            icon_url: client.user.avatarURL()
                        },
                        description: `ขณะนี้กำลังเล่น: [${((track.title).slice(0, 20))}...](${track.uri})`,
                        footer: {
                            text: client.user.username,
                            icon_url: client.user.avatarURL()
                        }
                    }
                ]
            })
        } else if (namecmd === "queue") {
            const { channel } = interaction.member.voice;

            let player = client.manager.get(interaction.guildId);

            if (!player) return interaction.reply({ content: "ไม่มีเพลงที่เล่นอยู่" })

            if (channel.id != player.voiceChannel) return interaction.reply({ content: "คุณไม่ได้อยู่ห้องเดียวกับบอท" })

            if (!player.queue.current) return interaction.reply({ content: "ไม่มีเพลงที่เล่นอยู่" })

            const track = player.queue

            interaction.reply({
                embeds: [
                    {
                        author: {
                            name: client.user.username,
                            icon_url: client.user.avatarURL()
                        },
                        description: track.map(t => `**${(track.indexOf(t) + 1)}** **${t.title.substr(0, 15)}**`).join("\n"),
                        fields: [
                            {
                                name: "กำลังเล่นเพลง...",
                                value: player.queue.current.title
                            },
                            {
                                name: "มีคิวทั้งหมด",
                                value: track.length + "queue"
                            }
                        ],
                        footer: {
                            text: client.user.username,
                            icon_url: client.user.avatarURL()
                        }
                    }
                ]
            })
        } else if (namecmd === "loop") {
            const { channel } = interaction.member.voice;

        } else if (namecmd === "resume") {
            const { channel } = interaction.member.voice;

            let player = client.manager.get(interaction.guildId);

            if (!player) return interaction.reply({ content: "ไม่มีเพลงที่เล่นอยู่" })

            if (channel.id != player.voiceChannel) return interaction.reply({ content: "คุณไม่ได้อยู่ห้องเดียวกับบอท" })

            if (player.playing) {
                player.pause(player.playing);
                return interaction.reply({ content: "หยุดเพลงแล้ว" })
            } else {
                player.pause(player.playing);
                return interaction.reply({ content: "เล่นเพลงต่อแล้ว" })
            }
        }
    }
})

client.manager = new Manager({
    // The nodes to connect to, optional if using default lavalink options
    nodes,
    // Method to send voice data to Discord
    send: (id, payload) => {
        const guild = client.guilds.cache.get(id);
        // NOTE: FOR ERIS YOU NEED JSON.stringify() THE PAYLOAD
        if (guild) guild.shard.send(payload);
    }
});

client.manager.on("nodeConnect", node => {
    console.log(`Node "${node.options.identifier}" connected.`)
})

client.manager.on("trackStart", (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    // Send a message when the track starts playing with the track name and the requester's Discord tag, e.g. username#discriminator
    channel.send(`Now playing: \`${track.title}\`, requested by \`${track.requester.tag}\`.`);
});

client.manager.on("queueEnd", player => {
    const channel = client.channels.cache.get(player.textChannel);
    channel.send("Queue has ended.");
    player.destroy();
});

client.login(token)