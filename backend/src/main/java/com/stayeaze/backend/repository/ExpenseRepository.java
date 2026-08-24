package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Expense;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    List<Expense> findByOrganizationOrderByExpenseDateDesc(Organization organization);

    List<Expense> findByOrganizationAndPropertyIdOrderByExpenseDateDesc(Organization organization, UUID propertyId);

    @Query("SELECT SUM(e.amount) FROM Expense e WHERE e.organization = :org")
    BigDecimal getTotalExpensesByOrganization(@Param("org") Organization organization);
}
