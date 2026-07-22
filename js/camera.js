/* === 相机模块 === */

const Camera = (() => {

  /** 创建 file input 并等待用户选择，处理取消操作 */
  function pickFile(captureMode) {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (captureMode) input.capture = "environment";

      let settled = false;

      // 用户选了文件
      input.onchange = async () => {
        settled = true;
        cleanup();
        const file = input.files[0];
        if (!file) { reject(new Error("未选择图片")); return; }

        try {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              let base64 = e.target.result;
              if (file.size > 500 * 1024) {
                base64 = await Utils.compressImage(base64, 1200, 0.75);
              }
              resolve(base64);
            } catch (err) {
              reject(new Error("图片处理失败: " + (err.message || "未知错误")));
            }
          };
          reader.onerror = () => reject(new Error("读取图片失败"));
          reader.readAsDataURL(file);
        } catch (err) {
          reject(err);
        }
      };

      // 用户取消：监听窗口重获焦点（file picker 关闭后触发）
      function onFocus() {
        setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error("已取消"));
          }
        }, 300); // 给 onchange 一点时间先触发
      }

      // 也监听取消事件（部分浏览器支持）
      input.oncancel = () => {
        settled = true;
        cleanup();
        reject(new Error("已取消"));
      };

      // 60 秒安全超时
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error("操作超时，请重试"));
        }
      }, 60000);

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener("focus", onFocus);
        input.remove();
      }

      window.addEventListener("focus", onFocus);
      input.click();
    });
  }

  /** 拍照（优先后置摄像头） */
  function capture() {
    return pickFile(true);
  }

  /** 从相册选择 */
  function pickFromGallery() {
    return pickFile(false);
  }

  return { capture, pickFromGallery };
})();
