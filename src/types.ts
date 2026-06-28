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
  product_type: 'glitch_art' | 'ui_kit' | 'cyber_zine' | 'cyber_prompt' | 'terminal_game' | 'vapor_synth' | 'shader_filter';
  ipfs_hash?: string;
  sales_count: number;
  collaboration_details?: {
    artist_name: string;
    artist_persona: string;
    commission_fee: number;
  };
}

export interface GrantProposal {
  id: string;
  title: string;
  target_foundation: string;
  concept_summary: string;
  full_proposal_text: string;
  requested_amount: number;
  status: 'draft' | 'submitted' | 'reviewing' | 'funded' | 'rejected';
  created_at: string;
  foundation_url: string;
}

export interface ActiveProject {
  id: string; // grant proposal id
  title: string;
  status: 'active' | 'completed';
  started_at: string;
  target_completion_date: string;
  mandate: {
    focus_product_types?: Product['product_type'][];
    focus_scrape_urls?: string[];
  };
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
  lemonsqueezy_configured: boolean;
  etsy_configured: boolean;
}
