# RPG バランス方針（2026-11-11 決定）

- ロールは7つ：attacker / gunner / tank / healer / buffer / debuffer / unique。仕分けは roles.md、データは `games/rpg/src/data/roles.js`。細分化しない。ロールに必須の技は決めない（ステータス区分のみ）
- 基本ステータスはロール共通、攻撃は全ロール 50：
  attacker hp300 speed6.6 ／ gunner hp200 speed6.4 ／ tank hp480 speed5.8 被ダメ0.8 ／ healer hp220 speed6.4 ／ buffer・debuffer hp230 speed6.4 ／ unique は通常攻撃が近接なら attacker、飛び道具なら gunner と同じ
  例外：鬼・幽霊・韋駄天は特性そのものがステータス差なので倍率を掛ける
- 職ごとの差は技と特性、火力係数 power・支援係数 support（`data/jobs.js`）だけで付ける。後掛けの一括補正（旧 MELEE_BUFF）は使わない
- 編成の制限はなし
- 難易度：4人の標準編成（剣士・重騎士・僧侶・魔法使い）で各ボス 3〜5分。ボスの痛さ（避けないとき毎秒削られる量）は僧侶1人の回復の約1.5倍。避けないと負ける
- ソロは協力よりやや簡単：剣士1人で各ボス 3〜5分、ボスの与ダメージは協力時の 0.7倍
- 人数による難しさは揃える：1〜8人のどの人数でも撃破時間 3〜5分（人数ごとの表 RAID_SCALE）
  標準編成：2人＝剣士＋僧侶 ／ 3人＝＋魔法使い ／ 4人＝＋重騎士 ／ 5〜8人＝剣士→魔法使い→重騎士→僧侶 の順で足す
- 目標帯（剣士=100、回復は僧侶=100）：
  attacker 火力 90〜115 ／ gunner 85〜110 ／ tank 55〜75 ／ healer 火力 40〜60・回復 70〜100 ／ buffer 火力 50〜70・PT 貢献 90〜115 ／ debuffer 火力 55〜75・PT 貢献 90〜115 ／ unique 火力 80〜110
  味方の火力を上げる効果が測れない支援職（鈍化・弾消し・ゲージ配りなど）は、火力を帯の上端に置いて埋め合わせる
- ステージ1（剣士固定）は従来の難しさのまま

計測のやり方：`node games/rpg/tools/balance/run.mjs <名前>`（職業）／`bosses.mjs`（ボス）／`tune.mjs <名前>`（帯を外れた職の係数を直す）。playwright と Chrome が要る
