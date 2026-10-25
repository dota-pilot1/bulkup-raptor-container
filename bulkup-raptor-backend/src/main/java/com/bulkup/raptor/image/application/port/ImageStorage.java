package com.bulkup.raptor.image.application.port;

public interface ImageStorage {
    String upload(String key, byte[] content, String contentType);
}
