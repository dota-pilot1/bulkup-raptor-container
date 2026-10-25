package com.bulkup.raptor.image.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.r2")
public class R2Properties {
    private String accessKeyId = "";
    private String secretAccessKey = "";
    private String endpoint = "";
    private String bucket = "";
    private String publicBaseUrl = "";

    public boolean isConfigured() {
        return !accessKeyId.isBlank() && !secretAccessKey.isBlank() && !endpoint.isBlank()
                && !bucket.isBlank() && !publicBaseUrl.isBlank();
    }
}
