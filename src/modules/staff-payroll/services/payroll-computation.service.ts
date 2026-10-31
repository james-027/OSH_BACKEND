import { Injectable } from "@nestjs/common";

import { PayrollDetails } from "src/entities/PayrollDetails";
import { PayrollHeader } from "src/entities/PayrollHeader";
import { SssConfigs } from "src/entities/SssConfig";

import {
  DAYS_FACTOR_RATE,
  WORKING_DAY_IDS,
} from "src/constants/customConstants";
import { roundMoney } from "src/utils/math.utils";

@Injectable()
export class PayrollComputationService {
  /**
   * ============================================================
   * PAYROLL DETAIL COMPUTATION
   * ============================================================
   */
  computePayrollDetail({
    detail,
    payrollHeader,
    salaryRate,
    staffSalary,
    sssConfigs,
    timeKeeping,
    salaryRateEffectivity,
  }: {
    detail: PayrollDetails;
    payrollHeader: PayrollHeader;
    salaryRate: number;
    staffSalary?: any;
    sssConfigs: SssConfigs[];
    timeKeeping?: any;
    salaryRateEffectivity?: Date | null;
  }): Partial<PayrollDetails> | null {
    if (!salaryRate) {
      return null;
    }

    /**
     * ----------------------------------------------------------
     * BASIC VALUES
     * ----------------------------------------------------------
     */
    const hourRate = this.computeHourRate(salaryRate);
    const regular = Number(detail.regular) || 0;
    const overtime = Number(detail.overtime) || 0;
    const nightShift = Number(detail.night_shift) || 0;
    const nightShiftAmount = roundMoney(((salaryRate * 0.1) / 8) * nightShift);
    const isNotForPremium = Boolean(detail.is_not_for_premium_pay);

    /**
     * Helper to determine overtime rate multiplier under Approach B:
     * When is_not_for_premium_pay is true (e.g. agency fault / no reliever sent),
     * the company only pays standard straight rate (1.0x), and the agency
     * absorbs the statutory premium surplus markup.
     */
    const getOtMultiplier = (standardMultiplier: number): number => {
      return isNotForPremium ? 1.0 : standardMultiplier;
    };

    /**
     * ----------------------------------------------------------
     * WORKING DAY & OVERTIME COMPUTATIONS
     * ----------------------------------------------------------
     */
    let regularAmount = 0;
    let restDayAmount = 0;
    let specialHolidayAmount = 0;
    let regularHolidayAmount = 0;
    let regularHolidayOffAmount = 0;
    let rdRegularHolidayAmount = 0;
    let rdSpecialHolidayAmount = 0;

    let otRegularAmount = 0;
    let otRestDayAmount = 0;
    let otSpecialHolidayAmount = 0;
    let otRegularHolidayAmount = 0;
    let otRdRegularHolidayAmount = 0;
    let otRdSpecialHolidayAmount = 0;

    switch (detail.working_day_id) {
      case WORKING_DAY_IDS.REGULAR_DAY:
        regularAmount = roundMoney(regular * hourRate);
        otRegularAmount = roundMoney(overtime * hourRate * getOtMultiplier(1.25));
        break;

      case WORKING_DAY_IDS.REGULAR_HOLIDAY:
        // RH = #hrs * salary_rate/8 * 2
        regularHolidayAmount = roundMoney(regular * hourRate * 2.0);
        otRegularHolidayAmount = roundMoney(overtime * hourRate * getOtMultiplier(2.6));
        break;

      case WORKING_DAY_IDS.SPECIAL_HOLIDAY:
        // SPH = #hrs * salary_rate/8 * 1.30
        specialHolidayAmount = roundMoney(regular * hourRate * 1.3);
        otSpecialHolidayAmount = roundMoney(overtime * hourRate * getOtMultiplier(1.69));
        break;

      case WORKING_DAY_IDS.REST_DAY_REGULAR_HOLIDAY:
        // RD & RH = (#hrs * salary_rate/8 * 2) + (#hrs * salary_rate/8 * 0.3)
        rdRegularHolidayAmount = roundMoney(
          regular * hourRate * 2.0 + regular * hourRate * 0.3,
        );
        otRdRegularHolidayAmount = roundMoney(overtime * hourRate * getOtMultiplier(3.38));
        break;

      case WORKING_DAY_IDS.REST_DAY_SPECIAL_HOLIDAY:
        // RD & SPH = (#hrs * salary_rate/8) * 1.50
        rdSpecialHolidayAmount = roundMoney(regular * hourRate * 1.5);
        otRdSpecialHolidayAmount = roundMoney(overtime * hourRate * getOtMultiplier(1.95));
        break;

      case WORKING_DAY_IDS.REGULAR_HOLIDAY_OFF:
        // RH OFF = #hrs * salary_rate/8
        regularHolidayOffAmount = roundMoney(regular * hourRate);
        break;

      case WORKING_DAY_IDS.REST_DAY:
        // RD = #hrs * salary_rate/8 * 1.30
        restDayAmount = roundMoney(regular * hourRate * 1.3);
        otRestDayAmount = roundMoney(overtime * hourRate * getOtMultiplier(1.69));
        break;

      default:
        regularAmount = roundMoney(regular * hourRate);
        otRegularAmount = roundMoney(overtime * hourRate * getOtMultiplier(1.25));
        break;
    }

    const regularDayAmount = roundMoney(
      regularAmount +
      restDayAmount +
      specialHolidayAmount +
      regularHolidayAmount +
      regularHolidayOffAmount +
      rdRegularHolidayAmount +
      rdSpecialHolidayAmount,
    );

    const overtimeAmount = roundMoney(
      otRegularAmount +
      otRestDayAmount +
      otSpecialHolidayAmount +
      otRegularHolidayAmount +
      otRdRegularHolidayAmount +
      otRdSpecialHolidayAmount,
    );

    const grossPay = roundMoney(regularDayAmount + overtimeAmount + nightShiftAmount);

    /**
     * ----------------------------------------------------------
     * WORKING DAY COMPUTATION
     * ----------------------------------------------------------
     */
    const workingDayValues = this.computeWorkingDayValues(
      detail,
      regular,
      overtime,
    );

    const totalOvertimeDayWork =
      this.computeTotalOvertimeDayWork(workingDayValues);

    const totalHoursWorked = this.computeTotalHoursWorked(workingDayValues);

    const totalDayWorkFraction =
      this.computeTotalDayWorkFraction(totalHoursWorked);

    const dutyCount = this.computeDutyCount(totalDayWorkFraction);

    /**
     * ----------------------------------------------------------
     * 13TH MONTH PAY
     * ----------------------------------------------------------
     */
    const thirteenMonthPay = roundMoney(
      this.computeThirteenMonthPay(hourRate, totalHoursWorked),
    );

    const netAmtDiser = roundMoney(grossPay + thirteenMonthPay);

    /**
     * ----------------------------------------------------------
     * GOVERNMENT CONTRIBUTIONS
     * ----------------------------------------------------------
     */
    const { sssShare, ec } = this.computeSssShare(
      salaryRate,
      totalDayWorkFraction,
      sssConfigs,
    );

    const pagIbigShare = roundMoney(
      this.computePagIbigShare(staffSalary, totalDayWorkFraction),
    );

    const philHealthShare = roundMoney(
      this.computePhilHealthShare(salaryRate, staffSalary, totalDayWorkFraction),
    );

    const totalGovtShare = roundMoney(
      sssShare + pagIbigShare + philHealthShare + thirteenMonthPay,
    );

    /**
     * ----------------------------------------------------------
     * VENDOR / BILLING VALUES
     * ----------------------------------------------------------
     */
    const billingValues = this.computeBilling(
      detail,
      timeKeeping,
      grossPay,
      totalGovtShare,
      dutyCount,
    );

    /**
     * ----------------------------------------------------------
     * FINAL RESULT
     * ----------------------------------------------------------
     */
    return {
      salary_rate: roundMoney(salaryRate),
      hour_rate: roundMoney(hourRate),

      night_shift: nightShift,
      night_shift_amount: nightShiftAmount,

      regular_amount: regularAmount,
      rest_day_amount: restDayAmount,
      special_holiday_amount: specialHolidayAmount,
      regular_holiday_amount: regularHolidayAmount,
      regular_holiday_off_amount: regularHolidayOffAmount,
      rd_regular_holiday_amount: rdRegularHolidayAmount,
      rd_special_holiday_amount: rdSpecialHolidayAmount,

      regular_day_amount: regularDayAmount,

      ot_regular_amount: otRegularAmount,
      ot_rest_day_amount: otRestDayAmount,
      ot_special_holiday_amount: otSpecialHolidayAmount,
      ot_regular_holiday_amount: otRegularHolidayAmount,
      ot_rd_regular_holiday_amount: otRdRegularHolidayAmount,
      ot_rd_special_holiday_amount: otRdSpecialHolidayAmount,
      overtime_amount: overtimeAmount,

      gross_pay: grossPay,

      regular_day: workingDayValues.regularDay,
      special_holiday: workingDayValues.specialHoliday,
      regular_holiday: workingDayValues.regularHoliday,
      rest_day: workingDayValues.restDay,

      ot_regular_day: workingDayValues.regularDayOvertime,
      ot_special_holiday: workingDayValues.specialHolidayOvertime,
      ot_regular_holiday: workingDayValues.regularHolidayOvertime,
      ot_rest_day: workingDayValues.restDayOvertime,

      total_ot_day_work: totalOvertimeDayWork,
      total_day_work: dutyCount,

      thirteen_month_pay: thirteenMonthPay,
      net_amt_diser: netAmtDiser,
      sss_share: sssShare,
      ec: ec,
      pag_ibig_share: pagIbigShare,
      phil_health_share: philHealthShare,

      total_govt_share: totalGovtShare,

      total_payroll: billingValues.totalPayroll,
      asf: billingValues.asf,
      total_asf: billingValues.totalAsf,
      allowance: billingValues.allowance,
      total_allowance: billingValues.totalAllowance,
      vat: billingValues.vat,
      total_with_vat: billingValues.totalWithVat,
      tax: billingValues.tax,
      net_of_tax: billingValues.netOfTax,
      cash_bond: billingValues.cashBond,
      total_billing: billingValues.totalBilling,
      salary_rate_effectivity: salaryRateEffectivity,
    };
  }

  /**
   * ============================================================
   * BASIC RATE COMPUTATION
   * ============================================================
   */
  private computeHourRate(salaryRate: number): number {
    return salaryRate / 8;
  }

  /**
   * ============================================================
   * BASIC PAY COMPUTATION
   * ============================================================
   */
  private computeRegularAmount(regular: number, salaryRate: number): number {
    return (regular * salaryRate) / 8;
  }

  private computeOvertimeAmount(overtime: number, salaryRate: number): number {
    const hourRate = salaryRate / 8;
    return overtime * hourRate * 1.25;
  }

  private computeGrossPay(
    regularAmount: number,
    overtimeAmount: number,
  ): number {
    return regularAmount + overtimeAmount;
  }

  /**
   * ============================================================
   * WORKING DAY COMPUTATION
   * ============================================================
   */
  private computeWorkingDayValues(
    detail: PayrollDetails,
    regular: number,
    overtime: number,
  ): {
    regularDay: number;
    specialHoliday: number;
    regularHoliday: number;
    restDay: number;
    regularDayOvertime: number;
    specialHolidayOvertime: number;
    regularHolidayOvertime: number;
    restDayOvertime: number;
  } {
    let regularDay = 0;
    let specialHoliday = 0;
    let regularHoliday = 0;
    let restDay = 0;

    let regularDayOvertime = 0;
    let specialHolidayOvertime = 0;
    let regularHolidayOvertime = 0;
    let restDayOvertime = 0;

    switch (detail.working_day_id) {
      case WORKING_DAY_IDS.REGULAR_DAY:
        regularDay = regular;
        regularDayOvertime = overtime;
        break;

      case WORKING_DAY_IDS.REGULAR_HOLIDAY:
      case WORKING_DAY_IDS.REGULAR_HOLIDAY_OFF:
      case WORKING_DAY_IDS.REST_DAY_REGULAR_HOLIDAY:
        regularHoliday = regular;
        regularHolidayOvertime = overtime;
        break;

      case WORKING_DAY_IDS.SPECIAL_HOLIDAY:
      case WORKING_DAY_IDS.REST_DAY_SPECIAL_HOLIDAY:
        specialHoliday = regular;
        specialHolidayOvertime = overtime;
        break;

      case WORKING_DAY_IDS.REST_DAY:
        restDay = regular;
        restDayOvertime = overtime;
        break;
    }

    return {
      regularDay,
      specialHoliday,
      regularHoliday,
      restDay,
      regularDayOvertime,
      specialHolidayOvertime,
      regularHolidayOvertime,
      restDayOvertime,
    };
  }

  private computeTotalOvertimeDayWork(workingDayValues: {
    regularDayOvertime: number;
    specialHolidayOvertime: number;
    regularHolidayOvertime: number;
    restDayOvertime: number;
  }): number {
    return (
      workingDayValues.regularDayOvertime +
      workingDayValues.specialHolidayOvertime +
      workingDayValues.regularHolidayOvertime +
      workingDayValues.restDayOvertime
    );
  }

  private computeTotalHoursWorked(workingDayValues: {
    regularDay: number;
    specialHoliday: number;
    regularHoliday: number;
    restDay: number;
  }): number {
    return (
      workingDayValues.regularDay +
      workingDayValues.specialHoliday +
      workingDayValues.regularHoliday +
      workingDayValues.restDay
    );
  }

  private computeTotalDayWorkFraction(totalHoursWorked: number): number {
    return totalHoursWorked / 8;
  }

  private computeDutyCount(totalDayWorkFraction: number): number {
    return Math.round(totalDayWorkFraction);
  }

  /**
   * ============================================================
   * 13TH MONTH PAY
   * ============================================================
   */
  private computeThirteenMonthPay(
    hourRate: number,
    totalHoursWorked: number,
  ): number {
    return (hourRate * totalHoursWorked) / 12;
  }

  /**
   * ============================================================
   * SSS COMPUTATION
   * ============================================================
   */
  private computeSssShare(
    salaryRate: number,
    totalDayWorkFraction: number,
    sssConfigs: SssConfigs[],
  ): { sssShare: number; ec: number } {
    const lookupValue = salaryRate * DAYS_FACTOR_RATE.DAYS;

    const sssConfig = sssConfigs.find((config) => {
      const rangeFrom = Number(config.range_from) || 0;
      const rangeTo = Number(config.range_to) || 0;
      return lookupValue >= rangeFrom && lookupValue <= rangeTo;
    });

    const withMpfEc = Number(sssConfig?.with_mpf_ec) || 0;
    const ec = Number(sssConfig?.ec) || 0;
    const sampleMpf = withMpfEc / DAYS_FACTOR_RATE.DAYS;

    return {
      sssShare: roundMoney(sampleMpf * totalDayWorkFraction),
      ec,
    };
  }

  /**
   * ============================================================
   * PAG-IBIG COMPUTATION
   * ============================================================
   */
  private computePagIbigShare(
    staffSalary: any,
    totalDayWorkFraction: number,
  ): number {
    const pagibigNumberPerc = Number(staffSalary?.pagibig_number_perc) || 0;
    const pagibigDailyRate = roundMoney(
      pagibigNumberPerc / DAYS_FACTOR_RATE.DAYS,
    );

    return roundMoney(pagibigDailyRate * totalDayWorkFraction);
  }

  /**
   * ============================================================
   * PHILHEALTH COMPUTATION
   * ============================================================
   */
  private computePhilHealthShare(
    salaryRate: number,
    staffSalary: any,
    totalDayWorkFraction: number,
  ): number {
    const philHealthContriPerc =
      Number(staffSalary?.phil_health_contri_perc) || 0;

    const philHealthDailyRate = roundMoney(
      (salaryRate * (philHealthContriPerc / 100)) / 2,
    );

    return roundMoney(philHealthDailyRate * totalDayWorkFraction);
  }

  /**
   * ============================================================
   * BILLING COMPUTATION
   * ============================================================
   */
  private computeBilling(
    detail: PayrollDetails,
    timeKeeping: any,
    grossPay: number,
    totalGovtShare: number,
    dutyCount: number,
  ): {
    totalPayroll: number;
    asf: number;
    totalAsf: number;
    allowance: number;
    totalAllowance: number;
    vat: number;
    totalWithVat: number;
    tax: number;
    netOfTax: number;
    cashBond: number;
    totalBilling: number;
  } {
    const vendorAsfField = Number(detail.vendor?.asf) || 0;
    const vendorVatField = Number(detail.vendor?.vat) || 0;
    const vendorTaxField = Number(detail.vendor?.tax) || 0;
    const warehouseAllowance = Number(detail.warehouse?.allowance) || 0;

    const totalPayroll = roundMoney(grossPay + totalGovtShare);
    const asf = roundMoney(totalPayroll * vendorAsfField);
    const totalAsf = roundMoney(totalPayroll + asf);
    const allowance = roundMoney(warehouseAllowance * dutyCount);
    const totalAllowance = roundMoney(totalAsf + allowance);
    const vat = roundMoney(totalAllowance * vendorVatField);
    const totalWithVat = roundMoney(totalAllowance + vat);
    const tax = roundMoney(totalAllowance * vendorTaxField);
    const netOfTax = roundMoney(totalWithVat - tax);

    const cashBondEnabled = Boolean(Number(timeKeeping?.cash_bond));
    const cashBond = cashBondEnabled ? roundMoney(grossPay * 0.01) : 0;
    const totalBilling = roundMoney(netOfTax - cashBond);

    return {
      totalPayroll,
      asf,
      totalAsf,
      allowance,
      totalAllowance,
      vat,
      totalWithVat,
      tax,
      netOfTax,
      cashBond,
      totalBilling,
    };
  }

  /**
   * ============================================================
   * PAYROLL HEADER TOTALS
   * ============================================================
   */
  computePayrollHeaderTotals(
    details: PayrollDetails[],
  ): Partial<PayrollHeader> {
    let totalGrossPay = 0;

    let totalRegularDay = 0;
    let totalSpecialHoliday = 0;
    let totalRegularHoliday = 0;
    let totalRestDay = 0;
    let totalDayWork = 0;

    let totalOtRegularDay = 0;
    let totalOtSpecialHoliday = 0;
    let totalOtRegularHoliday = 0;
    let totalOtRestDay = 0;
    let totalOtDayWork = 0;

    // --- Regular Pay Amounts ---
    let totalRegularAmount = 0;
    let totalRestDayAmount = 0;
    let totalSpecialHolidayAmount = 0;
    let totalRegularHolidayAmount = 0;
    let totalRegularHolidayOffAmount = 0;
    let totalRdRegularHolidayAmount = 0;
    let totalRdSpecialHolidayAmount = 0;

    let totalRegularDayAmount = 0;

    // --- Overtime Pay Amounts ---
    let totalOtRegularAmount = 0;
    let totalOtRestDayAmount = 0;
    let totalOtSpecialHolidayAmount = 0;
    let totalOtRegularHolidayAmount = 0;
    let totalOtRdRegularHolidayAmount = 0;
    let totalOtRdSpecialHolidayAmount = 0;
    let totalOvertimeAmount = 0;

    let totalNightShift = 0;
    let totalNightShiftAmount = 0;

    let totalThirteenMonthPay = 0;

    let totalNetAmtDiser = 0;

    let totalGovtShare = 0;

    let totalSssShare = 0;
    let totalPagIbigShare = 0;
    let totalPhilHealthShare = 0;

    let totalPayroll = 0;
    let totalAsf = 0;
    let totalAllowance = 0;
    let totalVat = 0;
    let totalWithVat = 0;
    let totalTax = 0;
    let totalNetOfTax = 0;
    let totalCashBond = 0;
    let totalBilling = 0;

    for (const detail of details) {
      totalGrossPay += Number(detail.gross_pay) || 0;

      totalRegularDay += Number(detail.regular_day) || 0;
      totalSpecialHoliday += Number(detail.special_holiday) || 0;
      totalRegularHoliday += Number(detail.regular_holiday) || 0;
      totalRestDay += Number(detail.rest_day) || 0;

      totalOtRegularDay += Number(detail.ot_regular_day) || 0;
      totalOtSpecialHoliday += Number(detail.ot_special_holiday) || 0;
      totalOtRegularHoliday += Number(detail.ot_regular_holiday) || 0;
      totalOtRestDay += Number(detail.ot_rest_day) || 0;
      totalOtDayWork += Number(detail.total_ot_day_work) || 0;

      totalGovtShare += Number(detail.total_govt_share) || 0;

      // Sum Regular Pay Amounts
      totalRegularAmount += Number(detail.regular_amount) || 0;
      totalRestDayAmount += Number(detail.rest_day_amount) || 0;
      totalSpecialHolidayAmount += Number(detail.special_holiday_amount) || 0;
      totalRegularHolidayAmount += Number(detail.regular_holiday_amount) || 0;
      totalRegularHolidayOffAmount +=
        Number(detail.regular_holiday_off_amount) || 0;
      totalRdRegularHolidayAmount +=
        Number(detail.rd_regular_holiday_amount) || 0;
      totalRdSpecialHolidayAmount +=
        Number(detail.rd_special_holiday_amount) || 0;

      totalRegularDayAmount += Number(detail.regular_day_amount) || 0;

      // Sum Overtime Pay Amounts
      totalOtRegularAmount += Number(detail.ot_regular_amount) || 0;
      totalOtRestDayAmount += Number(detail.ot_rest_day_amount) || 0;
      totalOtSpecialHolidayAmount +=
        Number(detail.ot_special_holiday_amount) || 0;
      totalOtRegularHolidayAmount +=
        Number(detail.ot_regular_holiday_amount) || 0;
      totalOtRdRegularHolidayAmount +=
        Number(detail.ot_rd_regular_holiday_amount) || 0;
      totalOtRdSpecialHolidayAmount +=
        Number(detail.ot_rd_special_holiday_amount) || 0;
      totalOvertimeAmount += Number(detail.overtime_amount) || 0;

      totalNightShift += Number(detail.night_shift) || 0;
      totalNightShiftAmount += Number(detail.night_shift_amount) || 0;

      totalDayWork += Number(detail.total_day_work) || 0;
      totalThirteenMonthPay += Number(detail.thirteen_month_pay) || 0;
      totalNetAmtDiser += Number(detail.net_amt_diser) || 0;

      totalSssShare += Number(detail.sss_share) || 0;
      totalPagIbigShare += Number(detail.pag_ibig_share) || 0;
      totalPhilHealthShare += Number(detail.phil_health_share) || 0;

      totalPayroll += Number(detail.total_payroll) || 0;
      totalAsf += Number(detail.total_asf) || 0;
      totalAllowance += Number(detail.total_allowance) || 0;
      totalVat += Number(detail.vat) || 0;
      totalWithVat += Number(detail.total_with_vat) || 0;
      totalTax += Number(detail.tax) || 0;
      totalNetOfTax += Number(detail.net_of_tax) || 0;
      totalCashBond += Number(detail.cash_bond) || 0;
      totalBilling += Number(detail.total_billing) || 0;
    }

    return {
      total_gross_pay: roundMoney(totalGrossPay),

      total_regular_day: roundMoney(totalRegularDay),
      total_special_holiday: roundMoney(totalSpecialHoliday),
      total_regular_holiday: roundMoney(totalRegularHoliday),
      total_rest_day: roundMoney(totalRestDay),
      total_day_work: roundMoney(totalDayWork),

      total_ot_regular_day: roundMoney(totalOtRegularDay),
      total_ot_special_holiday: roundMoney(totalOtSpecialHoliday),
      total_ot_regular_holiday: roundMoney(totalOtRegularHoliday),
      total_ot_rest_day: roundMoney(totalOtRestDay),
      total_ot_day_work: roundMoney(totalOtDayWork),

      total_govt_share: roundMoney(totalGovtShare),

      total_regular_amount: roundMoney(totalRegularAmount),
      total_rest_day_amount: roundMoney(totalRestDayAmount),
      total_special_holiday_amount: roundMoney(totalSpecialHolidayAmount),
      total_regular_holiday_amount: roundMoney(totalRegularHolidayAmount),
      total_regular_holiday_off_amount: roundMoney(totalRegularHolidayOffAmount),
      total_rd_regular_holiday_amount: roundMoney(totalRdRegularHolidayAmount),
      total_rd_special_holiday_amount: roundMoney(totalRdSpecialHolidayAmount),

      total_regular_day_amount: roundMoney(totalRegularDayAmount),

      total_ot_regular_amount: roundMoney(totalOtRegularAmount),
      total_ot_rest_day_amount: roundMoney(totalOtRestDayAmount),
      total_ot_special_holiday_amount: roundMoney(totalOtSpecialHolidayAmount),
      total_ot_regular_holiday_amount: roundMoney(totalOtRegularHolidayAmount),
      total_ot_rd_regular_holiday_amount: roundMoney(totalOtRdRegularHolidayAmount),
      total_ot_rd_special_holiday_amount: roundMoney(totalOtRdSpecialHolidayAmount),
      total_overtime_amount: roundMoney(totalOvertimeAmount),

      total_night_shift: roundMoney(totalNightShift),
      total_night_shift_amount: roundMoney(totalNightShiftAmount),

      total_thirteen_month_pay: roundMoney(totalThirteenMonthPay),
      total_net_amt_diser: roundMoney(totalNetAmtDiser),
      total_sss_share: roundMoney(totalSssShare),
      total_pag_ibig_share: roundMoney(totalPagIbigShare),
      total_phil_health_share: roundMoney(totalPhilHealthShare),
      total_payroll: roundMoney(totalPayroll),
      total_asf: roundMoney(totalAsf),
      total_allowance: roundMoney(totalAllowance),
      total_vat: roundMoney(totalVat),
      total_with_vat: roundMoney(totalWithVat),
      total_tax: roundMoney(totalTax),
      total_net_of_tax: roundMoney(totalNetOfTax),
      total_cash_bond: roundMoney(totalCashBond),
      total_billing: roundMoney(totalBilling),
    };
  }
}
