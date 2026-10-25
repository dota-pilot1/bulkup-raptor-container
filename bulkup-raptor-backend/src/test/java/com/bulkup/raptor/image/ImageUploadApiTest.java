package com.bulkup.raptor.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.common.error.GlobalExceptionHandler;
import com.bulkup.raptor.config.SecurityConfig;
import com.bulkup.raptor.image.api.ImageUploadController;
import com.bulkup.raptor.image.application.port.ImageStorage;
import com.bulkup.raptor.image.application.service.ImageUploadService;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@SpringJUnitWebConfig(ImageUploadApiTest.Config.class)
class ImageUploadApiTest {
    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, ImageUploadController.class, ImageUploadService.class, GlobalExceptionHandler.class})
    static class Config {
        @Bean ImageStorage storage() { return mock(ImageStorage.class); }
        @Bean MemberRepository members() { return mock(MemberRepository.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired ImageStorage storage;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        reset(storage);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(storage.upload(anyString(), any(byte[].class), anyString()))
                .thenAnswer(call -> "https://images.example.com/" + call.getArgument(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"png", "jpg", "webp"})
    void uploadsSupportedImageWithGeneratedKey(String format) throws Exception {
        byte[] bytes;
        if (format.equals("webp")) {
            try (var input = getClass().getResourceAsStream("/images/sample.webp")) {
                bytes = input.readAllBytes();
            }
        } else {
            bytes = image(format, 2, 3);
        }
        String type = "image/" + (format.equals("jpg") ? "jpeg" : format);
        mvc.perform(multipart("/api/admin/images")
                        .file(new MockMultipartFile("file", "../../unsafe." + format, type, bytes))
                        .with(user("operator").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value(org.hamcrest.Matchers.matchesPattern(
                        "products/[0-9a-f-]{36}\\." + format)))
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("https://images.example.com/products/")))
                .andExpect(jsonPath("$.contentType").value(type))
                .andExpect(jsonPath("$.size").value(bytes.length))
                .andExpect(jsonPath("$.width").isNumber())
                .andExpect(jsonPath("$.height").isNumber());
        verify(storage).upload(anyString(), eq(bytes), eq(type));
    }

    @Test
    void anonymousCannotUpload() throws Exception {
        mvc.perform(multipart("/api/admin/images").file(file("image/png", image("png", 1, 1))))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(storage);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MENU_ADMIN_ACCESS", "ROLE_ADMIN", "ROLE_MEMBER"})
    void menuOrRoleAloneDoesNotPermitUpload(String authority) throws Exception {
        mvc.perform(multipart("/api/admin/images").file(file("image/png", image("png", 1, 1)))
                        .with(user("reader").authorities(new SimpleGrantedAuthority(authority))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(storage);
    }

    @Test
    void missingAndEmptyFilesAreRejected() throws Exception {
        mvc.perform(multipart("/api/admin/images").with(user("admin").authorities(
                        new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("IMAGE_FILE_REQUIRED"));
        reject("image/png", new byte[0], 400, "IMAGE_FILE_REQUIRED");
    }

    @Test
    void spoofedOrCorruptedImagesAreRejected() throws Exception {
        reject("image/png", "not an image".getBytes(), 400, "IMAGE_FILE_INVALID");
        reject("image/jpeg", image("png", 1, 1), 400, "IMAGE_FILE_INVALID");
        byte[] png = image("png", 5, 5);
        reject("image/png", java.util.Arrays.copyOf(png, 35), 400, "IMAGE_FILE_INVALID");
    }

    @Test
    void unsupportedAndMissingContentTypesAreRejected() throws Exception {
        reject("image/svg+xml", "<svg/>".getBytes(), 415, "IMAGE_TYPE_NOT_SUPPORTED");
        reject(null, image("png", 1, 1), 415, "IMAGE_TYPE_NOT_SUPPORTED");
    }

    @Test
    void oversizedBytesAndDimensionsAreRejected() throws Exception {
        reject("image/png", new byte[(int) ImageUploadService.MAX_FILE_SIZE + 1], 413, "IMAGE_FILE_TOO_LARGE");
        reject("image/png", image("png", 4097, 1), 400, "IMAGE_DIMENSIONS_TOO_LARGE");
    }

    @Test
    void storageFailureIsReturnedWithoutInternalDetails() throws Exception {
        when(storage.upload(anyString(), any(), anyString()))
                .thenThrow(new BusinessException(ErrorCode.IMAGE_STORAGE_FAILED));
        mvc.perform(multipart("/api/admin/images").file(file("image/png", image("png", 1, 1)))
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("IMAGE_STORAGE_FAILED"));
    }

    @Test
    void jsonIsNotAnUpload() throws Exception {
        mvc.perform(post("/api/admin/images").contentType("application/json").content("{}")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isUnsupportedMediaType());
        verifyNoInteractions(storage);
    }

    private void reject(String type, byte[] bytes, int status, String code) throws Exception {
        mvc.perform(multipart("/api/admin/images").file(file(type, bytes))
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code));
        verifyNoInteractions(storage);
    }

    private MockMultipartFile file(String type, byte[] bytes) {
        return new MockMultipartFile("file", "test.png", type, bytes);
    }

    private byte[] image(String format, int width, int height) throws Exception {
        var output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, output)).isTrue();
        return output.toByteArray();
    }
}
