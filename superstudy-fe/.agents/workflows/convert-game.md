---
description: Chuyển đổi file HTML game thành đúng chuẩn hệ thống SPerStudy (inline SDK, self-contained)
---

# Chuyển đổi Game HTML cho hệ thống SPerStudy

Khi user cung cấp file HTML game (có thể là file đơn hoặc nhiều file HTML/CSS/JS), hãy thực hiện các bước sau để chuyển đổi thành **1 file HTML duy nhất** đúng chuẩn hệ thống.

## Bước 1: Đọc và phân tích file game

- Đọc file HTML game mà user cung cấp
- Xác định các file CSS/JS bên ngoài được tham chiếu (qua `<link>`, `<script src="...">`)
- Nếu có file CSS/JS riêng trong cùng thư mục → đọc nội dung của chúng

## Bước 2: Kiểm tra và inline SDK

Kiểm tra xem game đã có SuperStudySDK chưa. Nếu chưa hoặc đang tham chiếu file ngoài, **inline SDK** sau vào `<head>`:

```html
<script>
/* SPerStudy Game SDK v1.0 — inline */
(function () {
    'use strict';
    window.SuperStudySDK = {
        _data: null,
        _onDataCallbacks: [],
        onData: function (callback) {
            if (typeof callback !== 'function') return;
            if (this._data) { callback(this._data); }
            else { this._onDataCallbacks.push(callback); }
        },
        notifyComplete: function (summary) {
            try { window.parent.postMessage({ type: 'GAME_COMPLETE', summary: summary || {} }, '*'); } catch (e) {}
        },
        requestReload: function () {
            try { window.parent.postMessage({ type: 'GAME_REQUEST_RELOAD' }, '*'); } catch (e) {}
        }
    };
    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'GAME_DATA') {
            window.SuperStudySDK._data = event.data;
            window.SuperStudySDK._onDataCallbacks.forEach(function (cb) {
                try { cb(event.data); } catch (e) { console.error('SDK callback error:', e); }
            });
            window.SuperStudySDK._onDataCallbacks = [];
        }
    });
})();
</script>
```

## Bước 3: Inline tất cả CSS

- Tìm tất cả `<link rel="stylesheet" href="...">` trỏ đến file local (không phải CDN)
- Đọc nội dung file CSS đó
- Thay thế `<link>` bằng `<style>` chứa nội dung CSS inline
- **GIỮ NGUYÊN** các link CDN (Google Fonts, etc.)

## Bước 4: Inline tất cả JavaScript

- Tìm tất cả `<script src="...">` trỏ đến file local (không phải CDN)
- Đọc nội dung file JS đó
- Thay thế `<script src="...">` bằng `<script>` chứa nội dung JS inline
- **GIỮ NGUYÊN** các script CDN (PixiJS, Howler.js, etc.)
- **XÓA** tag `<script src="game-sdk.js">` hoặc `<script src="../game-sdk.js">` (đã inline ở bước 2)

## Bước 5: Đảm bảo game nhận dữ liệu từ SDK

Kiểm tra code JS có gọi `SuperStudySDK.onData(...)` để nhận dữ liệu không. Nếu game chưa tích hợp SDK:

- Thêm code nhận dữ liệu:
  ```javascript
  SuperStudySDK.onData(function(data) {
    // Ẩn loading, hiện game
    document.getElementById('loading').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    // Khởi tạo game với data
    if (data.dataType === 'vocabulary') startGame(data.words);
    else if (data.dataType === 'grammar') startGame(data.questions);
  });
  ```
- Thêm màn hình loading nếu chưa có
- Gọi `SuperStudySDK.notifyComplete()` khi game kết thúc (nếu chưa có)

## Bước 6: Kiểm tra responsive

- Đảm bảo có `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- Body nên dùng `100vh` thay vì giá trị pixel cố định
- Có `overflow: hidden` để tránh scroll trong iframe

## Bước 7: Lưu file kết quả

- Lưu file HTML đã chuyển đổi vào `public/games/{tên-game}/index.html`
- Tên game dùng kebab-case (VD: `word-match`, `tug-of-war`, `quiz-race`)
- Thông báo cho user file đã sẵn sàng upload lên portal `/it/games`

## Bước 8: Tạo file test (tùy chọn)

Nếu user yêu cầu, tạo file `test.html` cùng thư mục để test game locally:

```html
<!DOCTYPE html>
<html><body>
  <iframe id="f" src="index.html" width="100%" height="700" style="border:2px solid #333;"></iframe>
  <button onclick="sendData()">Gửi data test</button>
  <script>
    function sendData() {
      document.getElementById('f').contentWindow.postMessage({
        type: "GAME_DATA",
        dataType: "vocabulary",
        words: [
          { word: "apple", meaning: "quả táo", phonetic: "/ˈæp.əl/" },
          { word: "banana", meaning: "quả chuối" },
          { word: "cat", meaning: "con mèo", example: "The cat is sleeping." },
          { word: "dog", meaning: "con chó" },
          { word: "elephant", meaning: "con voi" }
        ]
      }, "*");
    }
    // Auto-send after iframe loads
    document.getElementById('f').onload = function() { setTimeout(sendData, 500); };
  </script>
</body></html>
```

## Checklist cuối cùng

Sau khi chuyển đổi xong, xác nhận:

- [ ] Tất cả code trong 1 file HTML duy nhất
- [ ] SDK đã inline (không `<script src="game-sdk.js">`)
- [ ] Không còn `<link href="local.css">` hay `<script src="local.js">`
- [ ] Có `SuperStudySDK.onData()` nhận dữ liệu
- [ ] Có `SuperStudySDK.notifyComplete()` khi kết thúc
- [ ] Responsive (viewport meta + 100vh)
- [ ] File size < 2MB
