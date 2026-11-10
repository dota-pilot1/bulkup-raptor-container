package com.bulkup.raptor.product.api;

import com.bulkup.raptor.product.service.ProductService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/products")
@RequiredArgsConstructor
public class AdminProductController {
    private final ProductService products;

    @GetMapping
    public List<ProductResponse> list() {
        return products.listForAdmin();
    }

    @PatchMapping("/{id}/sale")
    public ProductResponse setSale(@PathVariable Long id, @Valid @RequestBody SaleRequest request) {
        return products.setForSale(id, request.forSale());
    }

    public record SaleRequest(@NotNull Boolean forSale) {}
}
