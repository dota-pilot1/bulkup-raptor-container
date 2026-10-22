package com.bulkup.raptor.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI bulkupRaptorOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Bulkup Raptor API")
                .description("Bulkup Raptor Backend API Documentation")
                .version("v0.0.1"));
    }
}
