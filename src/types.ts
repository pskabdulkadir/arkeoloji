/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Artifact {
  id: string;
  name: string;
  source_url: string;
  extracted_at: string;
  category: string;
  raw_content: string;
  is_analyzed: boolean;
  is_listed: boolean;
  confidence: number;
  image_url?: string;
  source_image_url?: string;
  status: 'pending' | 'analyzed' | 'listed';
}

export interface Product {
  id: string;
  artifact_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  marketplace_url: string;
  created_at: string;
  tags: string[];
  is_listed: boolean;
  is_archived: boolean;
  product_type: 'glitch_art' | 'ui_kit' | 'cyber_zine' | 'cyber_prompt' | 'terminal_game' | 'vapor_synth';
  ipfs_hash?: string;
  sales_count?: number;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  module: 'DIGGER' | 'GEMINI' | 'MARKETPLACE' | 'IPFS' | 'SYSTEM';
}

export interface SystemStatus {
  firebase_connected: boolean;
  is_fallback: boolean;
  gemini_configured: boolean;
  gumroad_configured: boolean;
  ipfs_node_active: boolean;
}
