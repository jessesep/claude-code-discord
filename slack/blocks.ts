import { Block, KnownBlock } from "@slack/bolt";

/**
 * Formats a full agent response using Slack Block Kit
 */
export function formatAgentResponse(
  agentName: string,
  response: string,
  model?: string,
  client?: string
): (Block | KnownBlock)[] {
  const blocks: (Block | KnownBlock)[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🤖 ${agentName}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: response,
      },
    },
  ];

  if (model || client) {
    blocks.push({
      type: "context",
      elements: [
        ...(model ? [{ type: "mrkdwn", text: `*Model:* \`${model}\`` } as const] : []),
        ...(client ? [{ type: "mrkdwn", text: `*Provider:* \`${client}\`` } as const] : []),
      ],
    });
  }

  return blocks;
}

/**
 * Formats a streaming update with a cursor indicator
 */
export function formatStreamingUpdate(text: string): (Block | KnownBlock)[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: text + " ▌",
      },
    },
  ];
}

/**
 * Converts generic message content to Slack blocks
 */
export function convertToSlackBlocks(content: any): (Block | KnownBlock)[] {
  const blocks: (Block | KnownBlock)[] = [];

  if (content.content) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: content.content,
      },
    });
  }

  if (content.embeds) {
    for (const embed of content.embeds) {
      if (embed.title) {
        blocks.push({
          type: "header",
          text: {
            type: "plain_text",
            text: embed.title,
          },
        });
      }
      if (embed.description) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: embed.description,
          },
        });
      }
      if (embed.fields) {
        for (const field of embed.fields) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${field.name}*\n${field.value}`,
            },
          });
        }
      }
    }
  }

  if (content.components) {
    for (const row of content.components) {
      if (row.type === "actionRow") {
        const elements = row.components.map((comp: any) => ({
          type: "button",
          text: {
            type: "plain_text",
            text: comp.label,
          },
          action_id: comp.customId,
          style: comp.style === "danger" ? "danger" : (comp.style === "primary" ? "primary" : undefined),
        }));

        blocks.push({
          type: "actions",
          elements,
        });
      }
    }
  }

  return blocks;
}
