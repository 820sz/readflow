/* === 相机模块 === */

const Camera = (() => {
  let stream = null;

  /** 打开相机拍照（返回压缩后的 base64） */
  async function capture() {
    return new Promise(async (resolve, reject) => {
      // 创建临时 input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment"; // 优先后置摄像头

      input.onchange = async () => {
        const file = input.files[0];
        if (!file) { reject(new Error("未选择图片")); return; }

        // 转 base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          let base64 = e.target.result;
          // 压缩大图
          if (file.size > 500 * 1024) {
            base64 = await Utils.compressImage(base64, 1200, 0.75);
          }
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
      };

      input.click();
    });
  }

  /** 从相册选择 */
  async function pickFromGallery() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = async () => {
        const file = input.files[0];
        if (!file) { reject(new Error("未选择图片")); return; }

        const reader = new FileReader();
        reader.onload = async (e) => {
          let base64 = e.target.result;
          if (file.size > 500 * 1024) {
            base64 = await Utils.compressImage(base64, 1200, 0.75);
          }
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
      };

      input.click();
    });
  }

  return { capture, pickFromGallery };
})();
