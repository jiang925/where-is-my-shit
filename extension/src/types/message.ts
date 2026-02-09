export interface ExtractedMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;        // ISO 8601
  conversationId: string;
  conversationTitle: string;
  platform: string;
  url: string;              // deep link or conversation URL
  fingerprint?: string;     // SHA-256 hash, set after extraction
}

// Matches server IngestRequest exactly
export interface IngestPayload {
  id?: string;
  conversation_id: string;
  platform: string;
  title: string;
  content: string;
  role: string;
  timestamp: string;
  url: string;
}
