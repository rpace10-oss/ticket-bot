require("dotenv").config();
const http = require("http");
console.log("env loaded");

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

if (!process.env.DISCORD_TOKEN) {
  console.error("No DISCORD_TOKEN in .env");
  process.exit(1);
}

// Simple web server so Render sees an open port
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK\n");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("HTTP server listening on port " + PORT);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

client.once("ready", () => {
  console.log("Logged in as " + client.user.tag);
});

client.on("interactionCreate", async (interaction) => {
  // Slash command: /ticketpanel
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ticketpanel") {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Department Support Tickets")
        .setDescription(
          "Need assistance with anything related to the department?\n" +
          "Use the buttons below to open a ticket and a staff member will be with you shortly.\n\n" +
          "**What we can help with:**\n" +
          "> 🟢 General Support – Basic questions, info, or small issues.\n" +
          "> 🛡️ Command Ticket – Policy questions, complaints, or larger concerns.\n\n" +
          "Please only have one active ticket open at a time."
        )
        .setColor(0x5865f2)
		.setImage("https://blazesmods.com/cdn/shop/files/PATROL13.png?v=1721824805&width=1100");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_general")
          .setLabel("General Support")
          .setEmoji("🟢")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("ticket_command")
          .setLabel("Command Ticket")
          .setEmoji("🛡️")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: "✅ Ticket panel sent in this channel.",
        ephemeral: true
      });

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });
    }
  }

  // Buttons to create tickets
  if (interaction.isButton()) {
    // Close ticket button
    if (interaction.customId === "ticket_close") {
      const channel = interaction.channel;
      await interaction.reply({
        content: "Closing ticket in 10 seconds...",
        ephemeral: true
      });
      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 10000);
      return;
    }

    const typeMap = {
      ticket_general: "general-support",
      ticket_command: "command-ticket"
    };

    const type = typeMap[interaction.customId];
    if (!type) return;

    const guild = interaction.guild;
    const user = interaction.user;

    // Pick which role sees this ticket
    let supportRoleId = null;
    if (interaction.customId === "ticket_general") {
      supportRoleId = process.env.SUPERVISOR_ROLE_ID;
    } else if (interaction.customId === "ticket_command") {
      supportRoleId = process.env.COMMAND_ROLE_ID;
    }

    if (!supportRoleId) {
      console.error("No supportRoleId set. Check SUPERVISOR_ROLE_ID / COMMAND_ROLE_ID in .env");
      await interaction.reply({
        content: "Ticket could not be created (role not configured). Tell an admin.",
        ephemeral: true
      });
      return;
    }

    // Check for existing ticket
    const existing = guild.channels.cache.find((c) => {
      return (
        c.name === `${type}-${user.username}` &&
        c.parentId === process.env.TICKET_CATEGORY_ID
      );
    });

    if (existing) {
      await interaction.reply({
        content: `You already have an open ticket: ${existing}`,
        ephemeral: true
      });
      return;
    }

    // Create ticket channel
    const channel = await guild.channels.create({
      name: `${type}-${user.username}`,
      parent: process.env.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: supportRoleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ]
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle("🎫 New Ticket")
      .setDescription(
        `Hello ${user}, a staff member will be with you shortly.\n\n` +
        `**Type:** \`${type.replace("-", " ")}\`\n` +
        "Please explain your issue in as much detail as possible."
      )
      .setColor(0x5865f2);

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `${user} <@&${supportRoleId}>`,
      embeds: [ticketEmbed],
      components: [closeRow]
    });

    await interaction.reply({
      content: `Your ticket has been created: ${channel}`,
      ephemeral: true
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
