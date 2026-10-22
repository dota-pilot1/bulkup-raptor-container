package com.bulkup.raptor.config;

import com.bulkup.raptor.auth.infrastructure.session.MemberSessionValidationFilter;
import com.bulkup.raptor.auth.repository.MemberRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.expression.WebExpressionAuthorizationManager;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            MemberRepository memberRepository,
            CorsConfigurationSource corsConfigurationSource)
            throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                // 기존 로그인 상태를 먼저 검증한 뒤 API 접근 권한을 검사한다.
                .addFilterBefore(
                        // 직접 추가할 필터: 회원 상태와 버전으로 기존 인증 정보를 검증한다.
                        new MemberSessionValidationFilter(memberRepository),
                        // Spring Security 기본 필터: 현재 요청에 접근 권한이 있는지 검사한다.
                        AuthorizationFilter.class)
                .exceptionHandling(
                        errors ->
                                errors.authenticationEntryPoint(
                                                (request, response, exception) -> {
                                                    response.setStatus(401);
                                                    response.setContentType(
                                                            "application/problem+json;charset=UTF-8");
                                                    response.getWriter()
                                                            .write(
                                                                    "{\"code\":\"LOGIN_REQUIRED\",\"detail\":\"로그인이"
                                                                        + " 필요합니다.\"}");
                                                })
                                        .accessDeniedHandler(
                                                (request, response, exception) -> {
                                                    response.setStatus(403);
                                                    response.setContentType(
                                                            "application/problem+json;charset=UTF-8");
                                                    response.getWriter()
                                                            .write(
                                                                    "{\"code\":\"ACCESS_DENIED\",\"detail\":\"접근"
                                                                        + " 권한이 없습니다.\"}");
                                                }))
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(
                                                "/api/health",
                                                "/swagger-ui/**",
                                                "/v3/api-docs/**",
                                                "/swagger-ui.html",
                                                "/api/auth/**")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/products", "/api/products/**")
                                        .permitAll()
                                        // Menu permissions permit reads only. Commands retain their existing guards.
                                        .requestMatchers(HttpMethod.GET, "/api/admin/roles", "/api/admin/roles/**")
                                        .access(new WebExpressionAuthorizationManager(
                                                "hasAuthority('MENU_ADMIN_ACCESS')"
                                                        + " or (hasRole('ADMIN') and hasAnyAuthority('ROLE_MANAGE', 'MEMBER_ROLE_ASSIGN'))"))
                                        .requestMatchers(HttpMethod.GET,
                                                "/api/admin/permissions", "/api/admin/permissions/**",
                                                "/api/admin/permission-categories", "/api/admin/permission-categories/**")
                                        .access(new WebExpressionAuthorizationManager(
                                                "hasAuthority('MENU_ADMIN_ACCESS')"
                                                        + " or (hasRole('ADMIN') and hasAuthority('PERMISSION_MANAGE'))"))
                                        .requestMatchers(HttpMethod.GET, "/api/admin/members", "/api/admin/members/**")
                                        .access(new WebExpressionAuthorizationManager(
                                                "hasAuthority('MENU_ADMIN_ACCESS')"
                                                        + " or (hasRole('ADMIN') and hasAuthority('MEMBER_MANAGE'))"))
                                        .requestMatchers("/api/admin/roles", "/api/admin/roles/**")
                                        .access(
                                                new WebExpressionAuthorizationManager(
                                                        "hasRole('ADMIN') and"
                                                                + " hasAuthority('ROLE_MANAGE')"))
                                        .requestMatchers(
                                                "/api/admin/permissions",
                                                "/api/admin/permissions/**",
                                                "/api/admin/permission-categories",
                                                "/api/admin/permission-categories/**")
                                        .access(
                                                new WebExpressionAuthorizationManager(
                                                        "hasRole('ADMIN') and"
                                                            + " hasAuthority('PERMISSION_MANAGE')"))
                                        .requestMatchers(
                                                "/api/admin/members/*/role",
                                                "/api/admin/members/*/roles")
                                        .access(
                                                new WebExpressionAuthorizationManager(
                                                        "hasRole('ADMIN') and"
                                                            + " hasAuthority('MEMBER_ROLE_ASSIGN')"))
                                        .requestMatchers(
                                                "/api/admin/members", "/api/admin/members/**")
                                        .access(
                                                new WebExpressionAuthorizationManager(
                                                        "hasRole('ADMIN') and"
                                                                + " hasAuthority('MEMBER_MANAGE')"))
                                        .requestMatchers(
                                                "/api/admin/products", "/api/admin/products/**")
                                        .hasAuthority("PRODUCT_MANAGE")
                                        .requestMatchers(
                                                "/api/admin/orders", "/api/admin/orders/**")
                                        .hasAuthority("ORDER_MANAGE")
                                        .requestMatchers(
                                                "/api/admin/shipments", "/api/admin/shipments/**")
                                        .hasAuthority("SHIPPING_MANAGE")
                                        .requestMatchers("/api/admin/**")
                                        .hasRole("ADMIN")
                                        .requestMatchers("/api/products", "/api/products/**")
                                        .hasAuthority("PRODUCT_MANAGE")
                                        .anyRequest()
                                        .permitAll());
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
                    java.util.List<String> allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(
                java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(java.util.List.of("Content-Type", "Authorization"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
