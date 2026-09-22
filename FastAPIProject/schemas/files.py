"""文件相关的 Pydantic 模型：上传接口返回的文件元信息。"""

from datetime import datetime

from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    """文件元信息：上传接口的返回体，也是文件列表接口的元素结构。

    无数据库的演示实现：上传接口返回客户端提交的 original_name；
    列表接口由存储名反解（清洗后的近似值）。
    """

    original_name: str = Field(description="原始文件名", examples=["季度报告.pdf"])
    stored_name: str = Field(description="服务端生成的实际存储名（uuid_原名），下载与直链均以此为准")
    size: int = Field(description="文件大小（字节）", examples=[102400])
    content_type: str | None = Field(default=None, description="客户端声明的 MIME 类型（不可信，仅作展示参考）")
    uploaded_at: datetime = Field(description="上传时间 / 最后修改时间（UTC）")
    url: str = Field(description="静态直链（/uploads 挂载点），浏览器可直接访问")
    download_url: str = Field(description="下载接口地址（Content-Disposition: attachment 强制下载）")
