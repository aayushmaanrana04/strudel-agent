export interface EffectParams {
	lpf?: number;
	hpf?: number;
	lpq?: number;
	room?: number;
	roomsize?: number;
	delay?: number;
	delaytime?: number;
	delayfeedback?: number;
	gain?: number;
	pan?: number;
	speed?: number;
	crush?: number;
	shape?: number;
	attack?: number;
	decay?: number;
	sustain?: number;
	release?: number;
}

export interface DrumPatternParams {
	kick: string;
	snare: string;
	hihat: string;
	openhat?: string;
	other?: string[];
	bank?: string;
	tempo?: number;
	effects?: EffectParams;
}

export interface MelodicLineParams {
	type: 'bass' | 'melody' | 'pad' | 'lead';
	notes: string;
	useScaleDegrees?: boolean;
	scale?: string;
	sound: string;
	tempo?: number;
	effects?: EffectParams;
}

export interface SetTempoParams {
	bpm: number;
}

export interface AddEffectsParams {
	layerIndex: number;
	effects: EffectParams;
}

export interface RemoveLayerParams {
	layerIndex: number;
}

export interface LoadPresetParams {
	preset: string;
	tempo?: number;
}

export interface RawCodeParams {
	code: string;
}

export type ToolCall =
	| { tool: 'create_drum_pattern'; params: DrumPatternParams }
	| { tool: 'create_melodic_line'; params: MelodicLineParams }
	| { tool: 'set_tempo'; params: SetTempoParams }
	| { tool: 'add_effects'; params: AddEffectsParams }
	| { tool: 'remove_layer'; params: RemoveLayerParams }
	| { tool: 'load_preset'; params: LoadPresetParams }
	| { tool: 'stop_playback'; params: Record<string, never> }
	| { tool: 'raw_code'; params: RawCodeParams };

export interface ConversationMessage {
	role: 'user' | 'assistant';
	text: string;
	code?: string;
}

export interface ApiRequest {
	prompt: string;
	currentCode: string;
	conversationHistory: ConversationMessage[];
}

export interface ApiResponse {
	toolCalls: ToolCall[];
	code: string;
	action: 'update' | 'play' | 'stop' | 'none';
	message: string;
}
