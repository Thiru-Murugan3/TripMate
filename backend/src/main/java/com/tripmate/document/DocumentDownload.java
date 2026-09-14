package com.tripmate.document;

import org.springframework.core.io.Resource;

public record DocumentDownload(
        Resource resource,
        String fileName,
        String fileType,
        Long fileSize
) {
}
