package com.bulkup.raptor.order.domain;

import com.bulkup.raptor.product.domain.Product;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "order_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrderItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;
    // DB 외래 키는 상품 삭제 시 null로 바뀐다. 주문 당시 값은 아래 컬럼에 보존한다.
    @Column(name = "product_id") private Long productId;
    @Column(name = "product_name", nullable = false, length = 80) private String productName;
    @Column(name = "unit_price", nullable = false) private long unitPrice;
    @Column(nullable = false) private int quantity;
    @Column(name = "line_total", nullable = false) private long lineTotal;

    static OrderItem snapshot(Order order, Product product, int quantity) {
        var item = new OrderItem();
        item.order = order;
        item.productId = product.getId();
        item.productName = product.getName();
        item.unitPrice = product.getPrice();
        item.quantity = quantity;
        item.lineTotal = Math.multiplyExact(item.unitPrice, quantity);
        return item;
    }
}
