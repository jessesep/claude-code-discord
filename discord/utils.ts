// Discord message limits
export const DISCORD_LIMITS = {
  CONTENT: 2000,           // Maximum characters for message content field
  EMBED_DESCRIPTION: 4096, // Maximum characters for embed description
  EMBED_TITLE: 256,        // Maximum characters for embed title
  EMBED_FIELD_VALUE: 1024, // Maximum characters for embed field value
  EMBED_FOOTER: 2048,      // Maximum characters for embed footer
  TOTAL_MESSAGE: 6000,     // Maximum total characters (content + embeds)
} as const;

export function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Smart text splitting that preserves code blocks and finds natural break points
 * @param text - Text to split
 * @param maxLength - Maximum length per chunk (defaults to Discord content limit)
 * @param preserveCodeBlocks - Whether to preserve code block boundaries (default: true)
 */
export function splitText(
  text: string, 
  maxLength: number = DISCORD_LIMITS.CONTENT,
  preserveCodeBlocks: boolean = true
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  
  // If preserving code blocks, try to split at code block boundaries first
  if (preserveCodeBlocks) {
    const codeBlockRegex = /(```[\s\S]*?```)/g;
    const parts: Array<{ type: 'code' | 'text'; content: string; start: number; end: number }> = [];
    let lastIndex = 0;
    let match;
    
    // Find all code blocks
    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
          start: lastIndex,
          end: match.index
        });
      }
      parts.push({
        type: 'code',
        content: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex),
        start: lastIndex,
        end: text.length
      });
    }
    
    // If we found code blocks, process them separately
    if (parts.length > 0) {
      let currentChunk = '';
      
      for (const part of parts) {
        if (part.type === 'code') {
          // Code blocks should not be split - if they're too long, put them in their own chunk
          if (currentChunk.length + part.content.length > maxLength) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
            // If code block itself is too long, we have to split it (but preserve markers)
            if (part.content.length > maxLength) {
              // Extract language and content
              const codeMatch = part.content.match(/^```(\w+)?\n([\s\S]*?)\n```$/);
              if (codeMatch) {
                const lang = codeMatch[1] || '';
                const codeContent = codeMatch[2];
                // Split code content at newlines
                const codeLines = codeContent.split('\n');
                let codeChunk = `\`\`\`${lang}\n`;
                
                for (const line of codeLines) {
                  if (codeChunk.length + line.length + 2 > maxLength - 10) { // -10 for safety
                    codeChunk += '\n```';
                    chunks.push(codeChunk);
                    codeChunk = `\`\`\`${lang}\n${line}`;
                  } else {
                    codeChunk += (codeChunk.endsWith('\n') ? '' : '\n') + line;
                  }
                }
                if (codeChunk && !codeChunk.endsWith('```')) {
                  codeChunk += '\n```';
                  chunks.push(codeChunk);
                }
              } else {
                // Fallback: just split the code block
                chunks.push(part.content.substring(0, maxLength));
                if (part.content.length > maxLength) {
                  chunks.push(part.content.substring(maxLength));
                }
              }
            } else {
              currentChunk += part.content;
            }
          } else {
            currentChunk += part.content;
          }
        } else {
          // Regular text - split at natural boundaries
          const textChunks = splitTextAtNaturalBoundaries(part.content, maxLength - currentChunk.length);
          
          if (textChunks.length > 0) {
            currentChunk += textChunks[0];
            for (let i = 1; i < textChunks.length; i++) {
              chunks.push(currentChunk.trim());
              currentChunk = textChunks[i];
            }
          }
        }
        
        // If current chunk is getting too long, finalize it
        if (currentChunk.length >= maxLength * 0.9) { // 90% threshold to avoid edge cases
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      return chunks.filter(chunk => chunk.length > 0);
    }
  }
  
  // Fallback: split at natural boundaries (newlines, then spaces, then force split)
  return splitTextAtNaturalBoundaries(text, maxLength);
}

/**
 * Split text at natural boundaries (newlines, spaces, then force split)
 */
function splitTextAtNaturalBoundaries(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    // If adding this line would exceed limit
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If a single line is too long, split it at word boundaries
      if (line.length > maxLength) {
        const words = line.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          if (wordChunk.length + word.length + 1 > maxLength) {
            if (wordChunk) {
              chunks.push(wordChunk.trim());
              wordChunk = '';
            }
            
            // If a single word is still too long, force split it
            if (word.length > maxLength) {
              for (let i = 0; i < word.length; i += maxLength) {
                chunks.push(word.substring(i, i + maxLength));
              }
            } else {
              wordChunk = word;
            }
          } else {
            wordChunk += (wordChunk ? ' ' : '') + word;
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      } else {
        currentChunk = line;
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(chunk => chunk.length > 0);
}