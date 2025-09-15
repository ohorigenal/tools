// --- State ---
let currentSpeakerNames = [];
let game = null;

// --- UI elements ---
const setupPanel = document.getElementById('setupPanel');
const namesInput = document.getElementById('namesInput');
const btnDemo = document.getElementById('btnDemo');
const btnStart = document.getElementById('btnStart');
const overlay = document.getElementById('resultOverlay');
const orderList = document.getElementById('orderList');
const btnEdit = document.getElementById('btnEdit');

// 複数行placeholder
namesInput.placeholder = '1行につき1名を入力\n例:\nさとう\nたなか\nすずき\n...';
// Demo名
btnDemo.addEventListener('click', () => {
namesInput.value = [
    "さとう", "たなか", "すずき", "やまだ", "えんどう", "たかはし", "いとう", "こばやし", "まつもと", "やまぐち"
].join("\n");
});

// レース開始
btnStart.addEventListener('click', () => {
    const speakerList = namesInput.value.split(/\n|,/)
        .map(s => s.trim())
        .filter(Boolean);
    // バリデーション
    if(speakerList.length < 2){
        alert('2名以上を入力してください');
        return;
    }
    currentSpeakerNames = speakerList;
    startRace(speakerList);
});

btnEdit.addEventListener('click', () => {
    overlay.classList.remove('active');
    setupPanel.style.display = 'block';
});


function buildConfig(){
    const parent = document.getElementById('phaser-parent');
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || (window.innerHeight - 64); // - header height
    return {
        type: Phaser.AUTO,
        width: Math.max(720, Math.min(1280, w)),
        height: Math.max(400, Math.min(800, h)),
        parent: 'phaser-parent',
        backgroundColor: '#0b0f2b',
        pixelArt: true,
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: [RaceScene]
    };
}

// 走者カラー
const COLORS = [0xff4d6d, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xb5179e, 0x80ffdb, 0xf72585, 0x4895ef, 0x70e000, 0xffb703, 0x90be6d, 0xc77dff];

class RaceScene extends Phaser.Scene {
    constructor() {
        super('RaceScene');
    }

    init(data) {
        this.names = data && data.names ? data.names : currentSpeakerNames;
        this.finishOrder = [];
        this.runners = [];
        this.finishedSet = new Set();
    }

    preload() {
        this.charDefs = [
            { key: 'char1', a: 'assets/zombie_walk1.png', b: 'assets/zombie_walk2.png' },
            { key: 'char2', a: 'assets/soldier_walk1.png', b: 'assets/soldier_walk2.png' },
            { key: 'char3', a: 'assets/player_walk1.png', b: 'assets/player_walk2.png' },
            { key: 'char4', a: 'assets/female_walk1.png', b: 'assets/female_walk2.png' },
            { key: 'char5', a: 'assets/adventurer_walk1.png', b: 'assets/adventurer_walk2.png' },
            { key: 'char6', a: 'assets/zombie_walk1.png', b: 'assets/zombie_walk2.png', tint: COLORS[0] },
            { key: 'char7', a: 'assets/soldier_walk1.png', b: 'assets/soldier_walk2.png', tint: COLORS[1] },
            { key: 'char8', a: 'assets/player_walk1.png', b: 'assets/player_walk2.png', tint: COLORS[2] },
            { key: 'char9', a: 'assets/female_walk1.png', b: 'assets/female_walk2.png', tint: COLORS[3] },
            { key: 'char10', a: 'assets/adventurer_walk1.png', b: 'assets/adventurer_walk2.png', tint: COLORS[4] },
            { key: 'char11', a: 'assets/zombie_walk1.png', b: 'assets/zombie_walk2.png', tint: COLORS[5] },
            { key: 'char12', a: 'assets/soldier_walk1.png', b: 'assets/soldier_walk2.png', tint: COLORS[6] },
            { key: 'char13', a: 'assets/player_walk1.png', b: 'assets/player_walk2.png', tint: COLORS[7] },
            { key: 'char14', a: 'assets/female_walk1.png', b: 'assets/female_walk2.png', tint: COLORS[8] },
            { key: 'char15', a: 'assets/adventurer_walk1.png', b: 'assets/adventurer_walk2.png', tint: COLORS[9] },
        ];

        for (const c of this.charDefs) {
            this.load.image(`${c.key}_a`, c.a);
            this.load.image(`${c.key}_b`, c.b);
        }

        // シャッフル関数
        function shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        // keyをシャッフル
        const keys = this.charDefs.map(c => c.key);
        const shuffledKeys = shuffle([...keys]);

        // シャッフルしたkeyを再割り当て
        this.charDefs = this.charDefs.map((c, i) => ({ ...c, key: shuffledKeys[i] }));

        this.load.audio('bgm', ['assets/mushroom dance_0.ogg']);
    }

    create() {
        const W = this.sys.game.config.width;
        const H = this.sys.game.config.height;

        // スタートボタンを作成
        const startButton = this.add.text(W / 2, H / 2, 'スタート', {
            fontFamily: 'monospace',
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#5563d6',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });

        // スタートボタンのクリックイベント
        startButton.on('pointerdown', () => {
            startButton.destroy(); // ボタンを削除
            this.countdown('3'); // カウントダウン開始
            this.bgm.play();
        });

        // Track layout
        const margin = 24; // outer margin
        const trackTop = 80;
        const laneHeight = 40; // pixel lanes
        const totalHeight = laneHeight * this.names.length;
        const needed = trackTop + totalHeight + 80;
        if(needed > H){
            this.cameras.main.setZoom(H/needed);
        }

        // Finish line
        const finishX = W - 100;
        const g = this.add.graphics();
        g.lineStyle(2, 0xffffff, 0.6);
        for(let y=trackTop-10; y<trackTop + laneHeight*this.names.length; y+=6){
            g.lineBetween(finishX, y, finishX, y+3);
        }
        const flag = this.add.text(finishX - 12, trackTop - 46, '🏁', { fontSize: '32px' });

        // Create lanes & runners
        // === 2枚だけで歩行アニメを作成（交互ループ） ===
        for (const c of this.charDefs) {
            this.anims.create({
                key: `${c.key}_walk`,
                frames: [{ key: `${c.key}_a` }, { key: `${c.key}_b` }],
                frameRate: 8,     // 歩行速度（6〜12で好み調整）
                repeat: -1
            });
        }

        const startX = 32;
        for(let i=0;i<this.names.length;i++){
            const y = trackTop + i*laneHeight + 12;
            // lane divider
            const lane = this.add.rectangle(W/2, y+10, W-64, 1, 0x334, 0.6);

            const baseKey = `char${i%15 + 1}_a`;
            const sprite = this.physics.add.sprite(startX, y, baseKey)
                .setOrigin(0, 0.5);

            const charDef = this.charDefs.find(c => c.key == `char${i%15 + 1}`);

            // tint値を取得
            const tintValue = charDef ? charDef.tint : null;
            if (tintValue) {
                sprite.setTint(tintValue)
            }

            const tex = this.textures.get(baseKey).getSourceImage();
            const scale = 28 / tex.width;   // 幅基準
            sprite.setScale(scale);

            sprite.play(`char${i%15 + 1}_walk`);

            sprite.setData('name', this.names[i]);
            sprite.setData('baseSpeed', Phaser.Math.Between(70, 120)); // px/sec baseline
            sprite.setData('jitter', Phaser.Math.Between(15, 50)); // per-tick random
            sprite.setData('laneY', y);

            // name label
            const label = this.add.text(startX+40, y-16, this.names[i], { fontFamily:'monospace', fontSize:'14px', color:'#d8e0ff' });
            label.setData('follow', sprite);

            this.runners.push({ sprite, label });
        }

        // Countdown → start
        this.countdownText = this.add.text(W / 2, H / 2, '', { fontFamily:'monospace', fontSize:'40px', color:'#ffffff' }).setOrigin(0.5,0.5);
        this.bgm = this.sound.add('bgm', { loop: false, volume: 0.7 });
    }

    countdown(step) {
        this.countdownText.setText(step);
        const next = step === '3' ? '2' : step === '2' ? '1' : 'GO!';
        this.tweens.add({ targets: this.countdownText, alpha: { from: 0, to: 1 }, duration: 500, yoyo: true, onComplete: () => {
            if(step === 'GO!'){
                this.countdownText.setText('');
                this.startMoving();
            } else {
                this.countdown(next);
            }
        }});
    }

    startMoving() {
        this.racing = true;
    }

    update(time, delta) {
        if (!this.racing) return;
        const dt = delta / 1000;
        const W = this.sys.game.config.width;
        const finishX = W - 100;

        for (const r of this.runners) {
            if (this.finishedSet.has(r)) continue;
            const sprite = r.sprite;

            // baseSpeedの変更処理
            if (!sprite.getData('nextBaseSpeedChange') || time > sprite.getData('nextBaseSpeedChange')) {
                sprite.setData('baseSpeed', Phaser.Math.Between(40, 120)); // 新しいbaseSpeedを設定
                sprite.setData('jitter', Phaser.Math.Between(15, 50)); // per-tick random
                sprite.setData('nextBaseSpeedChange', time + Phaser.Math.Between(1000, 4000)); // 次の変更タイミング
            }
            const base = sprite.getData('baseSpeed');
            const jitter = sprite.getData('jitter');
            const boost = Phaser.Math.Between(-jitter, jitter);

            const vx = Math.max(40, base + boost);
            sprite.x += vx * dt;

            sprite.y = sprite.getData('laneY') + Math.sin(time / 90 + sprite.x * 0.05) * 1.5;

            r.label.x = sprite.x + 24;
            r.label.y = sprite.getData('laneY') - 16;

            if (sprite.x >= finishX) {
                this.onFinish(r);
            }
        }

        if (this.finishOrder.length === this.runners.length) {
            this.racing = false;
            this.time.delayedCall(400, () => showResult(this.finishOrder.map(x => x.sprite.getData('name'))));
        }
    }

    onFinish(r) {
        if (this.finishedSet.has(r)) return;
        this.finishedSet.add(r);
        this.finishOrder.push(r);

        const rank = this.finishOrder.length
        const crown = this.add.text(r.sprite.x + 6, r.sprite.y - 30, rank, { fontSize: '20px' }).setOrigin(0.5, 1);
        this.tweens.add({
            targets: crown,
            y: crown.y - 8,
            duration: 220,
            yoyo: true,
            repeat: 1,
            onComplete: () => crown.destroy()
        });
    }
}

function startRace(names){
    // hide setupPanel
    setupPanel.style.display = 'none';
    overlay.classList.remove('active');

    // gameオブジェクトの破棄
    if(game){ game.destroy(true); game = null; }

    // new game
    const cfg = buildConfig();
    game = new Phaser.Game(cfg);
    game.scene.start('RaceScene', { names });
}

function showResult(order){
    orderList.innerHTML = '';
    order.forEach((n) => {
        const li = document.createElement('li');
        li.textContent = n;
        orderList.appendChild(li);
    });
    overlay.classList.add('active');
}
