import { logger } from "./logger";

const DISCORD_WEBHOOK_URL_PR = process.env.DISCORD_WEBHOOK_URL_PR;

// Discord embed colors
export const DISCORD_COLORS = {
  BLUE: 0x5865f2, // New PR
  GREEN: 0x57f287, // Merged PR
  RED: 0xed4245, // Closed PR (not merged)
  YELLOW: 0xfee75c, // Warning
} as const;

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
}

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

/**
 * Send a notification to Discord via webhook
 * Fails gracefully - logs errors but doesn't throw
 */
export async function sendDiscordNotification(
  embed: DiscordEmbed,
  options?: { username?: string; avatarUrl?: string; webhookUrl?: string }
): Promise<boolean> {
  const webhookUrl = options?.webhookUrl ?? DISCORD_WEBHOOK_URL_PR;
  
  if (!webhookUrl) {
    logger.debug("Discord webhook not configured, skipping notification");
    return false;
  }

  const payload: DiscordWebhookPayload = {
    embeds: [embed],
    username: options?.username ?? "Cursor Boston Bot",
    avatar_url: options?.avatarUrl,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.error("Discord webhook request failed", {
        status: response.status,
        statusText: response.statusText,
      });
      return false;
    }

    logger.debug("Discord notification sent successfully", {
      title: embed.title,
    });
    return true;
  } catch (error) {
    logger.logError(error, {
      context: "Discord webhook notification",
      title: embed.title,
    });
    return false;
  }
}

/**
 * Send a PR opened notification to Discord
 */
export async function notifyPROpened(prData: {
  number: number;
  title: string;
  authorLogin: string;
  authorAvatarUrl?: string;
  url: string;
  repository: string;
}): Promise<boolean> {
  const embed: DiscordEmbed = {
    title: `New Pull Request #${prData.number}`,
    description: prData.title,
    url: prData.url,
    color: DISCORD_COLORS.BLUE,
    fields: [
      {
        name: "Author",
        value: `[@${prData.authorLogin}](https://github.com/${prData.authorLogin})`,
        inline: true,
      },
      {
        name: "Repository",
        value: `[${prData.repository}](https://github.com/${prData.repository})`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "GitHub Pull Request",
    },
  };

  if (prData.authorAvatarUrl) {
    embed.author = {
      name: prData.authorLogin,
      url: `https://github.com/${prData.authorLogin}`,
      icon_url: prData.authorAvatarUrl,
    };
  }

  return sendDiscordNotification(embed);
}

/**
 * Send a PR merged notification to Discord
 */
export async function notifyPRMerged(prData: {
  number: number;
  title: string;
  authorLogin: string;
  authorAvatarUrl?: string;
  url: string;
  repository: string;
  mergedAt?: string;
}): Promise<boolean> {
  const embed: DiscordEmbed = {
    title: `Pull Request Merged #${prData.number}`,
    description: prData.title,
    url: prData.url,
    color: DISCORD_COLORS.GREEN,
    fields: [
      {
        name: "Author",
        value: `[@${prData.authorLogin}](https://github.com/${prData.authorLogin})`,
        inline: true,
      },
      {
        name: "Repository",
        value: `[${prData.repository}](https://github.com/${prData.repository})`,
        inline: true,
      },
    ],
    timestamp: prData.mergedAt ?? new Date().toISOString(),
    footer: {
      text: "GitHub Pull Request",
    },
  };

  if (prData.authorAvatarUrl) {
    embed.author = {
      name: prData.authorLogin,
      url: `https://github.com/${prData.authorLogin}`,
      icon_url: prData.authorAvatarUrl,
    };
  }

  return sendDiscordNotification(embed);
}
