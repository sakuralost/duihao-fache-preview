/* 对号发车 — 布局常量与可替换配置 */

// 开通流量主后，把激励视频广告位 ID 填到这里即可接入真广告。
// 留空时走「观看（广告占位）」倒计时，并给予同等奖励，方便开发与提审前联调。
const AD_UNIT_ID = '';

// 备案截图专用开关：仅在微信开发者工具里截备案图时临时改为 true，截完必须改回 false（正式版保持关闭）。
const CAPTURE_MODE = false;

const SAVE_KEY = 'duihao-wechat-progress';
const VERSION = 'DUIHAO-WX-1.0.2';

// 舞台逻辑分辨率（与网页版一致）
const STAGE_W = 390, STAGE_H = 844;

const CELL = 44, LOT_X = 63, LOT_Y = 306, COLS = 6, ROWS = 8;
const SPOT_H = 106, SPOT_Y = 156, SPOT_CY = SPOT_Y + 8 + 41, MAX_EXTRA = 2;
const ROAD_Y = 286, LANE_L = 47, LANE_R = 343, LANE_B = 682;
const HEAD_X = 46, FEET_Y = 132, PAX_SP = 25, VISIBLE = 12;
const VEH_W = 36;
const DIR_ROT = { U: 0, R: 90, D: 180, L: -90 };
const CNAME = { A: '蓝', B: '橙', C: '紫', D: '绿' };
const CCOL = { A: '#2f7fd0', B: '#e5761b', C: '#8a5cc9', D: '#3f9e3f' };
const PAX_FLIP_IDLE = 1;

const SHARE_TITLE = '帮我解锁一个车位！《对号发车》';
const SHARE_IMAGE = 'assets/share-illu.jpg';

// 游戏圈首页（游戏内打开）。来自 MP → 游戏圈 → 基础设置 → 游戏内打开。
const GAME_CLUB_OPENLINK = '-SSEykJvFV3pORt5kTNpSxOGrDgxFr91wHUyG6LqPylSSR_tWYDokPbcRKtTvLg7Udvxa4hF_utX0uQ1Kg2xk7z1MfgG71ApiroUd20uEjCqIsB-Q_FLvtLCvIufAi9zQW31mrP_060cqbkEAaGiSCNeJNEaTppMc2WrXS_Z2E8802iQu5a-xYFF-xBild2-TFydkJ7HT32EQC3UU8fFT1JB6ZRkFvmFwbljQrTwiIsKIX0Q1WfJTOO49p5saz0__GRwcKGmFv6WzW2UAyS-jRMseTPJVz42PsgepDo42Jyw1mUWVnCOchpYD65eoqPyQcdrXnNLbbcAq5sXRMhoxA';

// 倒计时占位广告秒数（无广告位 ID 时使用）
const PLACEHOLDER_AD_SEC = 3;

module.exports = {
  AD_UNIT_ID, CAPTURE_MODE, SAVE_KEY, VERSION,
  STAGE_W, STAGE_H,
  CELL, LOT_X, LOT_Y, COLS, ROWS,
  SPOT_H, SPOT_Y, SPOT_CY, MAX_EXTRA,
  ROAD_Y, LANE_L, LANE_R, LANE_B,
  HEAD_X, FEET_Y, PAX_SP, VISIBLE,
  VEH_W, DIR_ROT, CNAME, CCOL, PAX_FLIP_IDLE,
  SHARE_TITLE, SHARE_IMAGE, GAME_CLUB_OPENLINK, PLACEHOLDER_AD_SEC,
};
