document.addEventListener('DOMContentLoaded', () => {
  const thumbnailContainer = document.getElementById('thumbnail-container');
  const searchBox = document.getElementById('search-box');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.querySelector('.lightbox-close');
  
  const csvControls = document.getElementById('csv-controls');
  const youtubePlaylistControls = document.getElementById('youtube-playlist-controls');
  const youtubeAllControls = document.getElementById('youtube-all-controls');
  const genjiLifeChannelControls = document.getElementById('genji-life-channel-controls');
  const youtubeSearchBox = document.getElementById('youtube-search-box');
  const youtubeSearchBtn = document.getElementById('youtube-search-btn');
  const channelUrlInput = document.getElementById('channel-url');
  const apiKeyInput = document.getElementById('api-key');
  const playlistSelectorContainer = document.getElementById('playlist-selector-container');
  const playlistSelector = document.getElementById('playlist-selector');
  const genjiLifePlaylistSelectorContainer = document.getElementById('genji-life-playlist-selector-container');
  const genjiLifePlaylistSelector = document.getElementById('genji-life-playlist-selector');

  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreBtn = document.getElementById('load-more-btn');

  let allVideos = [];
  let csvVideos = []; // CSVの全データを保持
  let nextPageToken = null;
  let currentSearchQuery = '';
  let currentPlaylistId = '';
  let currentSource = 'csv'; // 現在のデータソースを追跡
  const API_KEY = 'AIzaSyAuYkN76exq4pdnkF8ieF9bYP2Y5JNOrK8'; // キーをコード内で保持
  const CHANNEL_ID = 'UCXrp0H7BPBHx2YTYMiiKEAA'; // げんじさんのチャンネルID
  const GENJI_LIFE_CHANNEL_ID = 'UCheQrxcAGbLeghL0lLj-HMA'; // Genji_Life_ChannelのチャンネルID

  // --- 初期設定 ---
  apiKeyInput.value = API_KEY; // inputにはセットするが見せない
  channelUrlInput.value = 'https://www.youtube.com/@genji_official_'; // チャンネルURLをセット
  // ページの読み込みが完全に完了した時点で、最初のデータソースを読み込む
  function initialize() {
    const defaultSourceRadio = document.querySelector('input[name="source"][value="csv"]');
    if (defaultSourceRadio) {
        defaultSourceRadio.checked = true;
        // 対応するコントロールを表示
        csvControls.style.display = 'block';
        loadCsvData();
    }
  }

  // --- 関数定義 ---

  // ISO 8601 形式の動画時間をパースして秒に変換
  function getDurationInSeconds(duration) {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    if (!matches) return 0;
    const hours = parseInt(matches[1] || 0);
    const minutes = parseInt(matches[2] || 0);
    const seconds = parseInt(matches[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // ISO 8601 形式の動画時間を "mm:ss" または "hh:mm:ss" 形式に変換
  function formatDuration(duration) {
    const totalSeconds = getDurationInSeconds(duration);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
    }
  }
  
  // 複数の動画IDから詳細情報(時間、再生回数)を取得
  async function fetchVideoDetails(videoIds) {
    if (!videoIds || videoIds.length === 0) return {};
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds.join(',')}&key=${API_KEY}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    const detailsMap = {};
    if (data.items) {
      data.items.forEach(item => {
        detailsMap[item.id] = {
          duration: item.contentDetails.duration,
          views: item.statistics.viewCount,
        };
      });
    }
    return detailsMap;
  }

  // CSVをパースする関数
  function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];

    // ヘッダー行を除いてループ
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // "..." で囲まれた部分を考慮して分割する正規表現
      const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
      let values = [];
      let match;
      while (match = regex.exec(line)) {
        let value = match[1];
        // クォーテーションを削除
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1).replace(/""/g, '"');
        }
        values.push(value);
      }
      
      if (values.length === headers.length) {
        let row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index];
        });
        data.push(row);
      }
    }
    return data;
  }

  // CSVからデータを読み込む関数
  function loadCsvData() {
    fetch('げんじチャンネル.csv')
      .then(response => response.arrayBuffer())
      .then(buffer => {
        const decoder = new TextDecoder('utf-8');
        const csvText = decoder.decode(buffer);
        const parsedData = parseCSV(csvText);
        csvVideos = parsedData.map(video => {
          const videoId = video['コンテンツ'];
          if (!videoId) return null;
          return {
            id: videoId,
            title: video['動画のタイトル'],
            url: `https://www.youtube.com/watch?v=${videoId}`,
            date: video['動画公開時刻'],
            views: video['視聴回数'],
            thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          };
        }).filter(Boolean);

        // ラベルの日付を更新
        if (csvVideos.length > 0) {
            const dates = csvVideos.map(v => new Date(v.date)).filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) {
                const minDate = new Date(Math.min.apply(null, dates));
                const maxDate = new Date(Math.max.apply(null, dates));
                const formatDate = (date) => date.toLocaleDateString('ja-JP').replace(/\//g, '/');
                const labelSpan = document.getElementById('csv-label');
                if (labelSpan) {
                    labelSpan.textContent = `げんじチャンネル(${formatDate(minDate)} ~ ${formatDate(maxDate)})`;
                }
            }
        }

        allVideos = [...csvVideos]; // 表示用の配列にもコピー
        displayThumbnails(allVideos, false);
        loadMoreContainer.style.display = 'none'; // CSV表示では「続きを読む」は非表示
      });
  }

  // チャンネルの再生リストをすべて取得する関数
  async function loadAllPlaylists() {
    playlistSelectorContainer.style.display = 'block';
    playlistSelector.innerHTML = '<option>再生リストを読み込み中...</option>';

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId=${CHANNEL_ID}&maxResults=50&key=${API_KEY}`);
      const data = await response.json();
      if (data.error) throw new Error(`APIエラー: ${data.error.message}`);
      
      playlistSelector.innerHTML = '<option value="">再生リストを選択してください</option>';
      data.items.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist.id;
        option.textContent = playlist.snippet.title;
        playlistSelector.appendChild(option);
      });
    } catch (error) {
      playlistSelector.innerHTML = `<option>読み込み失敗</option>`;
      alert(`再生リストの読み込みに失敗しました: ${error.message}`);
      console.error(error);
    }
  }

  // Genji_Life_Channelの再生リストをすべて取得する関数
  async function loadGenjiLifeChannelPlaylists() {
    genjiLifePlaylistSelectorContainer.style.display = 'block';
    genjiLifePlaylistSelector.innerHTML = '<option>再生リストを読み込み中...</option>';

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId=${GENJI_LIFE_CHANNEL_ID}&maxResults=50&key=${API_KEY}`);
      const data = await response.json();
      if (data.error) throw new Error(`APIエラー: ${data.error.message}`);
      
      genjiLifePlaylistSelector.innerHTML = '<option value="">再生リストを選択してください</option>';
      data.items.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist.id;
        option.textContent = playlist.snippet.title;
        genjiLifePlaylistSelector.appendChild(option);
      });
    } catch (error) {
      genjiLifePlaylistSelector.innerHTML = `<option>読み込み失敗</option>`;
      alert(`再生リストの読み込みに失敗しました: ${error.message}`);
      console.error(error);
    }
  }

  // フィルタリングとマッピングの共通処理
  async function processAndDisplayVideos(items, isSearch = false, isLoadMore = false) {
      const videoIds = items.map(item => isSearch ? item.id.videoId : item.snippet.resourceId.videoId);
      const detailsMap = await fetchVideoDetails(videoIds);

      const newVideos = items
        .map(item => {
            const videoId = isSearch ? item.id.videoId : item.snippet.resourceId.videoId;
            const snippet = item.snippet;
            const details = detailsMap[videoId];

            if (!details || getDurationInSeconds(details.duration) < 120) {
                return null; // 2分未満の動画は除外
            }
            if (snippet.title.toLowerCase().includes('#shorts')) {
                return null; // タイトルに#shortsが含まれる動画は除外
            }
            if (!snippet.thumbnails.medium) {
                return null; // サムネイルがない場合も除外
            }

            return {
                id: videoId,
                title: snippet.title,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                date: snippet.publishedAt,
                views: details.views || 'N/A',
                thumbnail: snippet.thumbnails.medium.url,
                duration: formatDuration(details.duration),
            };
        })
        .filter(Boolean); // nullになった要素を配列から除去

    if (isLoadMore) {
        allVideos = allVideos.concat(newVideos);
        displayThumbnails(newVideos, true); // 新しい動画のみ追加表示
    } else {
        allVideos = newVideos;
        displayThumbnails(allVideos, false); // 全動画を入れ替え表示
    }

    if (nextPageToken) {
        loadMoreContainer.style.display = 'block';
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '続きを読む';
    } else {
        loadMoreContainer.style.display = 'none';
    }
  }

  // 特定の再生リストの動画を読み込む関数
  async function loadPlaylistItems(playlistId, token = null) {
    const isLoadMore = !!token;
    if (!isLoadMore) {
        allVideos = [];
        thumbnailContainer.innerHTML = '<p class="loading-message">動画を読み込み中...</p>';
        currentPlaylistId = playlistId;
        currentSource = 'youtube-playlist';
    } else {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = '読み込み中...';
    }

    try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${API_KEY}&pageToken=${token || ''}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data.error) throw new Error(`APIエラー: ${data.error.message}`);
        
        nextPageToken = data.nextPageToken || null;
        await processAndDisplayVideos(data.items, false, isLoadMore);

    } catch (error) {
        thumbnailContainer.innerHTML = `<p class="error-message">動画の読み込みに失敗しました: ${error.message}</p>`;
    }
  }

  // YouTube全体を検索する関数
  async function searchYouTube(query, token = null) {
    if (!query) return;

    const isLoadMore = !!token;
    if (!isLoadMore) {
        allVideos = [];
        thumbnailContainer.innerHTML = '<p class="loading-message">YouTubeを検索中...</p>';
        currentSearchQuery = query;
        currentSource = 'youtube-all';
    } else {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = '読み込み中...';
    }

    try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=50&type=video&key=${API_KEY}&pageToken=${token || ''}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data.error) throw new Error(`APIエラー: ${data.error.message}`);
        
        nextPageToken = data.nextPageToken || null;
        if(data.items.length === 0 && !token) {
            thumbnailContainer.innerHTML = '<p>検索結果がありませんでした。</p>';
            loadMoreContainer.style.display = 'none';
            return;
        }
        await processAndDisplayVideos(data.items, true, isLoadMore);

    } catch (error) {
        thumbnailContainer.innerHTML = `<p class="error-message">検索に失敗しました: ${error.message}</p>`;
    }
  }

  // サムネイルを表示する関数
  function displayThumbnails(videoData, shouldAppend = false) {
    if (!shouldAppend) {
        thumbnailContainer.innerHTML = '';
    }

    const fragment = document.createDocumentFragment();
    videoData.forEach(video => {
      const item = document.createElement('div');
      item.classList.add('thumbnail-item');

      const imageContainer = document.createElement('div');
      imageContainer.classList.add('thumbnail-image-container');
      
      const img = document.createElement('img');
      img.src = video.thumbnail;
      img.alt = video.title;
      // クリックでライトボックスを開くイベントリスナーをimg要素に追加
      img.addEventListener('click', () => {
        const highResUrl = `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`;
        lightboxImg.src = highResUrl;
        lightboxImg.onerror = () => {
          lightboxImg.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
        };
        lightbox.style.display = 'flex';
      });

      const duration = document.createElement('div');
      duration.classList.add('thumbnail-duration');
      duration.textContent = video.duration;

      imageContainer.appendChild(img);
      imageContainer.appendChild(duration);

      const titleLink = document.createElement('a');
      titleLink.href = video.url;
      titleLink.target = '_blank';
      titleLink.classList.add('title-link');

      const title = document.createElement('h3');
      title.textContent = video.title;
      
      titleLink.appendChild(title);

      // 再生数と公開日を表示するコンテナ
      const metaContainer = document.createElement('div');
      metaContainer.classList.add('thumbnail-meta');

      const views = document.createElement('p');
      views.classList.add('views');
      // 数値をフォーマットして表示
      if (video.views !== 'N/A') {
        const formattedViews = Number(video.views).toLocaleString();
        views.textContent = `${formattedViews} 回視聴`;
      } else {
        views.textContent = ' '; // 再生数がない場合は空にする
      }
      
      const date = document.createElement('p');
      date.classList.add('date');
      // 日付をフォーマット
      const formattedDate = new Date(video.date).toLocaleDateString('ja-JP');
      date.textContent = `${formattedDate}`;
      
      metaContainer.appendChild(views);
      metaContainer.appendChild(date);

      item.appendChild(imageContainer);
      item.appendChild(titleLink);
      item.appendChild(metaContainer);
      fragment.appendChild(item);
    });
    
    thumbnailContainer.appendChild(fragment);
  }

  // ライトボックスを閉じる処理
  function closeLightbox() {
    lightbox.style.display = 'none';
    lightboxImg.src = ''; // srcをクリア
  }

  // --- イベントリスナー ---

  // データソース切り替え
  document.querySelectorAll('input[name="source"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      // 全てのコントロールを一旦非表示
      csvControls.style.display = 'none';
      youtubePlaylistControls.style.display = 'none';
      youtubeAllControls.style.display = 'none';
      genjiLifeChannelControls.style.display = 'none';
      
      allVideos = []; // 表示をリセット
      displayThumbnails(allVideos);

      switch (e.target.value) {
        case 'csv':
          csvControls.style.display = 'block';
          loadCsvData();
          break;
        case 'youtube-playlist':
          youtubePlaylistControls.style.display = 'block';
          loadAllPlaylists();
          break;
        case 'youtube-all':
          youtubeAllControls.style.display = 'block';
          break;
        case 'genji-life-channel':
          genjiLifeChannelControls.style.display = 'block';
          loadGenjiLifeChannelPlaylists();
          break;
      }
    });
  });

  // CSV(げんじチャンネル)内検索
  searchBox.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredVideos = csvVideos.filter(video => {
      const title = video.title || '';
      return title.toLowerCase().includes(searchTerm);
    });
    displayThumbnails(filteredVideos, false); // 常に全入れ替え
  });

  // YouTube全体検索
  youtubeSearchBtn.addEventListener('click', () => {
    searchYouTube(youtubeSearchBox.value);
  });
  youtubeSearchBox.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchYouTube(youtubeSearchBox.value);
    }
  });

  // 再生リスト選択
  playlistSelector.addEventListener('change', (e) => {
    loadPlaylistItems(e.target.value);
  });

  // Genji_Life_Channel再生リスト選択
  genjiLifePlaylistSelector.addEventListener('change', (e) => {
    loadPlaylistItems(e.target.value);
  });

  // ライトボックス
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // 続きを読むボタン
  loadMoreBtn.addEventListener('click', () => {
    if (!nextPageToken) return;

    if (currentSource === 'youtube-all') {
      searchYouTube(currentSearchQuery, nextPageToken);
    } else if (currentSource === 'youtube-playlist') {
      loadPlaylistItems(currentPlaylistId, nextPageToken);
    }
  });

  // --- 初期化処理の実行 ---
  initialize();
});