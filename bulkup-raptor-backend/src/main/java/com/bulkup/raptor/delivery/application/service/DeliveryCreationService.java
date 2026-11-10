package com.bulkup.raptor.delivery.application.service;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.delivery.domain.Delivery;
import com.bulkup.raptor.delivery.repository.DeliveryRepository;
import com.bulkup.raptor.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeliveryCreationService {
    private final OrderRepository orders;
    private final DeliveryRepository deliveries;

    // Join the payment transaction. Locking the order serializes browser/webhook retries.
    @Transactional(propagation = Propagation.MANDATORY)
    public Delivery ensureForPaidOrder(Long orderId) {
        var order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
        if (!"PAID".equals(order.getStatus())) throw new BusinessException(ErrorCode.DELIVERY_ORDER_NOT_PAID);
        return deliveries.findByOrderId(orderId).orElseGet(() -> deliveries.saveAndFlush(Delivery.prepare(order)));
    }
}
