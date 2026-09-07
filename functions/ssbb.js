// 播放模拟游戏金币散落颗粒感的清脆进账音效（整体持续 ~2.2 秒）
function playCoinSound() {
  if (!soundEnabled) return;
  try {
    // 1. 确保 AudioContext 存在并处于运行状态
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;

    // 2. 预设 8 枚金币快速连续散落碰撞的时序、频率与音量（模拟金币掉落盘中的碎响）
    const coinDrops = [
      { delay: 0.00, freq: 1350, dur: 0.08, vol: 0.25 },
      { delay: 0.04, freq: 1850, dur: 0.09, vol: 0.30 },
      { delay: 0.07, freq: 1250, dur: 0.07, vol: 0.20 },
      { delay: 0.11, freq: 2100, dur: 0.10, vol: 0.35 },
      { delay: 0.15, freq: 1600, dur: 0.08, vol: 0.28 },
      { delay: 0.19, freq: 2450, dur: 0.11, vol: 0.38 },
      { delay: 0.24, freq: 1950, dur: 0.14, vol: 0.32 },
      { delay: 0.30, freq: 2200, dur: 0.18, vol: 0.25 }
    ];

    // 3. 循环触发快速散落金币撞击音粒
    coinDrops.forEach(coin => {
      const startTime = now + coin.delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      // 加入随机微调（±40Hz），让每次金币散落的声音都有微小差异，听起来更自然
      const randomFreq = coin.freq + (Math.random() * 80 - 40);
      osc.frequency.setValueAtTime(randomFreq, startTime);

      // 快速衰减，形成“叮/啪嗒”的硬币碰撞硬颗粒感
      gain.gain.setValueAtTime(coin.vol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + coin.dur);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + coin.dur);
    });

    // 4. 金属长共振尾音（高音 A6 阶，营造金币落定后的余响）
    const resonanceOsc = audioCtx.createOscillator();
    const resonanceGain = audioCtx.createGain();

    resonanceOsc.type = 'sine';
    resonanceOsc.frequency.setValueAtTime(1760, now + 0.15); // A6
    
    resonanceGain.gain.setValueAtTime(0.25, now + 0.15);
    resonanceGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

    resonanceOsc.connect(resonanceGain);
    resonanceGain.connect(audioCtx.destination);

    resonanceOsc.start(now + 0.15);
    resonanceOsc.stop(now + 2.0);

  } catch (e) {
    console.error("Audio playback error:", e);
  }
}
