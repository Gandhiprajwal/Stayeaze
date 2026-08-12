package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Invoice;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.InvoiceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class InvoiceService {

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Cacheable(value = "invoices", key = "#tenant != null ? #tenant.id.toString() : 'all'")
    public List<Invoice> getInvoicesByTenant(Tenant tenant) {
        if (tenant == null) {
            return invoiceRepository.findAll();
        }
        return invoiceRepository.findByTenant(tenant);
    }

    @Cacheable(value = "invoices", key = "#orgId != null ? #orgId.toString() : 'all_org'")
    public List<Invoice> getInvoicesByOrgId(UUID orgId) {
        if (orgId == null) {
            return invoiceRepository.findAll();
        }
        return invoiceRepository.findByOrganizationId(orgId);
    }

    @CacheEvict(value = "invoices", allEntries = true)
    public Invoice saveInvoice(Invoice invoice) {
        return invoiceRepository.save(invoice);
    }

    @CacheEvict(value = "invoices", allEntries = true)
    public void deleteInvoice(UUID id) {
        invoiceRepository.deleteById(id);
    }
}
