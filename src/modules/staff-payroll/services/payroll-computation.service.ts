import { Injectable } from "@nestjs/common";

import { PayrollDetails } from "src/entities/PayrollDetails";
import { PayrollHeader } from "src/entities/PayrollHeader";
import { SssConfigs } from "src/entities/SssConfig";

import {
  DAYS_FACTOR_RATE,
  WORKING_DAY_IDS,
} from "src/constants/customConstants";

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
    staffVendor,
    sssConfigs,
    timeKeeping,
  }: {
    detail: PayrollDetails;
    payrollHeader: PayrollHeader;
    salaryRate: number;
    staffVendor?: any;
    sssConfigs: SssConfigs[];
    timeKeeping?: any;
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
        regularAmount = regular * hourRate;
        otRegularAmount = overtime * hourRate * 1.25;
        break;

      case WORKING_DAY_IDS.REGULAR_HOLIDAY:
        // RH = #hrs * salary_rate/8 * 2
        regularHolidayAmount = regular * hourRate * 2.0;
        otRegularHolidayAmount = overtime * hourRate * 2.6;
        break;

      case WORKING_DAY_IDS.SPECIAL_HOLIDAY:
        // SPH = #hrs * salary_rate/8 * 1.30
        specialHolidayAmount = regular * hourRate * 1.3;
        otSpecialHolidayAmount = overtime * hourRate * 1.69;
        break;

      case WORKING_DAY_IDS.REST_DAY_REGULAR_HOLIDAY:
        // RD & RH = (#hrs * salary_rate/8 * 2) + (#hrs * salary_rate/8 * 0.3)
        rdRegularHolidayAmount =
          regular * hourRate * 2.0 + regular * hourRate * 0.3;
        otRdRegularHolidayAmount = overtime * hourRate * 3.38;
        break;

      case WORKING_DAY_IDS.REST_DAY_SPECIAL_HOLIDAY:
        // RD & SPH = (#hrs * salary_rate/8) * 1.50
        rdSpecialHolidayAmount = regular * hourRate * 1.5;
        otRdSpecialHolidayAmount = overtime * hourRate * 1.95;
        break;

      case WORKING_DAY_IDS.REGULAR_HOLIDAY_OFF:
        // RH OFF = #hrs * salary_rate/8
        regularHolidayOffAmount = regular * hourRate;
        break;

      case WORKING_DAY_IDS.REST_DAY:
        // RD = #hrs * salary_rate/8 * 1.30
        restDayAmount = regular * hourRate * 1.3;
        otRestDayAmount = overtime * hourRate * 1.69;
        break;

      default:
        regularAmount = regular * hourRate;
        otRegularAmount = overtime * hourRate * 1.25;
        break;
    }

    const overtimeAmount =
      otRegularAmount +
      otRestDayAmount +
      otSpecialHolidayAmount +
      otRegularHolidayAmount +
      otRdRegularHolidayAmount +
      otRdSpecialHolidayAmount;

    /**
     * TOTAL = REGULAR + RD + SPH + RH + RH OFF + (RD & RH) + (RD & SPH) + OVERTIME
     */
    const grossPay =
      regularAmount +
      restDayAmount +
      specialHolidayAmount +
      regularHolidayAmount +
      regularHolidayOffAmount +
      rdRegularHolidayAmount +
      rdSpecialHolidayAmount +
      overtimeAmount;

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
    const thirteenMonthPay = this.computeThirteenMonthPay(
      hourRate,
      totalHoursWorked,
    );

    /**
     * ----------------------------------------------------------
     * GOVERNMENT CONTRIBUTIONS
     * ----------------------------------------------------------
     */
    const sssShare = this.computeSssShare(
      salaryRate,
      totalDayWorkFraction,
      sssConfigs,
    );

    const pagIbigShare = this.computePagIbigShare(
      staffVendor,
      totalDayWorkFraction,
    );

    const philHealthShare = this.computePhilHealthShare(
      salaryRate,
      staffVendor,
      totalDayWorkFraction,
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
      dutyCount,
    );

    /**
     * ----------------------------------------------------------
     * FINAL RESULT
     * ----------------------------------------------------------
     */
    return {
      salary_rate: salaryRate,
      hour_rate: hourRate,

      regular_amount: regularAmount,
      rest_day_amount: restDayAmount,
      special_holiday_amount: specialHolidayAmount,
      regular_holiday_amount: regularHolidayAmount,
      regular_holiday_off_amount: regularHolidayOffAmount,
      rd_regular_holiday_amount: rdRegularHolidayAmount,
      rd_special_holiday_amount: rdSpecialHolidayAmount,

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
      sss_share: sssShare,
      pag_ibig_share: pagIbigShare,
      phil_health_share: philHealthShare,

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
  private computeRegularAmount(
    regular: number,
    salaryRate: number,
  ): number {
    return (regular * salaryRate) / 8;
  }

  private computeOvertimeAmount(
    overtime: number,
    salaryRate: number,
  ): number {
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
  ): number {
    const lookupValue = salaryRate * DAYS_FACTOR_RATE.DAYS;

    const sssConfig = sssConfigs.find((config) => {
      const rangeFrom = Number(config.range_from) || 0;
      const rangeTo = Number(config.range_to) || 0;
      return lookupValue >= rangeFrom && lookupValue <= rangeTo;
    });

    const withMpfEc = Number(sssConfig?.with_mpf_ec) || 0;
    const sampleMpf = withMpfEc / DAYS_FACTOR_RATE.DAYS;

    return sampleMpf * totalDayWorkFraction;
  }

  /**
   * ============================================================
   * PAG-IBIG COMPUTATION
   * ============================================================
   */
  private computePagIbigShare(
    staffVendor: any,
    totalDayWorkFraction: number,
  ): number {
    const pagibigNumberPerc = Number(staffVendor?.pagibig_number_perc) || 0;
    const pagibigDailyRate =
      Math.round((pagibigNumberPerc / DAYS_FACTOR_RATE.DAYS) * 100) / 100;

    return pagibigDailyRate * totalDayWorkFraction;
  }

  /**
   * ============================================================
   * PHILHEALTH COMPUTATION
   * ============================================================
   */
  private computePhilHealthShare(
    salaryRate: number,
    staffVendor: any,
    totalDayWorkFraction: number,
  ): number {
    const philHealthContriPerc =
      Number(staffVendor?.phil_health_contri_perc) || 0;

    const philHealthDailyRate =
      Math.round(
        ((salaryRate * (philHealthContriPerc / 100)) / 2) * 100,
      ) / 100;

    return philHealthDailyRate * totalDayWorkFraction;
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

    const totalPayroll = grossPay;
    const asf = totalPayroll * vendorAsfField;
    const totalAsf = totalPayroll + asf;
    const allowance = warehouseAllowance * dutyCount;
    const totalAllowance = totalAsf + allowance;
    const vat = totalAllowance * vendorVatField;
    const totalWithVat = totalAllowance + vat;
    const tax = totalAllowance * vendorTaxField;
    const netOfTax = totalWithVat - tax;

    const cashBondEnabled = Boolean(Number(timeKeeping?.cash_bond));
    const cashBond = cashBondEnabled ? grossPay * 0.01 : 0;
    const totalBilling = netOfTax - cashBond;

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

    // --- Overtime Pay Amounts ---
    let totalOtRegularAmount = 0;
    let totalOtRestDayAmount = 0;
    let totalOtSpecialHolidayAmount = 0;
    let totalOtRegularHolidayAmount = 0;
    let totalOtRdRegularHolidayAmount = 0;
    let totalOtRdSpecialHolidayAmount = 0;
    let totalOvertimeAmount = 0;

    let totalThirteenMonthPay = 0;

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

      // Sum Regular Pay Amounts
      totalRegularAmount += Number(detail.regular_amount) || 0;
      totalRestDayAmount += Number(detail.rest_day_amount) || 0;
      totalSpecialHolidayAmount += Number(detail.special_holiday_amount) || 0;
      totalRegularHolidayAmount += Number(detail.regular_holiday_amount) || 0;
      totalRegularHolidayOffAmount += Number(detail.regular_holiday_off_amount) || 0;
      totalRdRegularHolidayAmount += Number(detail.rd_regular_holiday_amount) || 0;
      totalRdSpecialHolidayAmount += Number(detail.rd_special_holiday_amount) || 0;

      // Sum Overtime Pay Amounts
      totalOtRegularAmount += Number(detail.ot_regular_amount) || 0;
      totalOtRestDayAmount += Number(detail.ot_rest_day_amount) || 0;
      totalOtSpecialHolidayAmount += Number(detail.ot_special_holiday_amount) || 0;
      totalOtRegularHolidayAmount += Number(detail.ot_regular_holiday_amount) || 0;
      totalOtRdRegularHolidayAmount += Number(detail.ot_rd_regular_holiday_amount) || 0;
      totalOtRdSpecialHolidayAmount += Number(detail.ot_rd_special_holiday_amount) || 0;
      totalOvertimeAmount += Number(detail.overtime_amount) || 0;

      totalDayWork += Number(detail.total_day_work) || 0;
      totalThirteenMonthPay += Number(detail.thirteen_month_pay) || 0;

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
      total_gross_pay: totalGrossPay,

      total_regular_day: totalRegularDay,
      total_special_holiday: totalSpecialHoliday,
      total_regular_holiday: totalRegularHoliday,
      total_rest_day: totalRestDay,
      total_day_work: totalDayWork,

      total_ot_regular_day: totalOtRegularDay,
      total_ot_special_holiday: totalOtSpecialHoliday,
      total_ot_regular_holiday: totalOtRegularHoliday,
      total_ot_rest_day: totalOtRestDay,
      total_ot_day_work: totalOtDayWork,

      total_regular_amount: totalRegularAmount,
      total_rest_day_amount: totalRestDayAmount,
      total_special_holiday_amount: totalSpecialHolidayAmount,
      total_regular_holiday_amount: totalRegularHolidayAmount,
      total_regular_holiday_off_amount: totalRegularHolidayOffAmount,
      total_rd_regular_holiday_amount: totalRdRegularHolidayAmount,
      total_rd_special_holiday_amount: totalRdSpecialHolidayAmount,

      total_ot_regular_amount: totalOtRegularAmount,
      total_ot_rest_day_amount: totalOtRestDayAmount,
      total_ot_special_holiday_amount: totalOtSpecialHolidayAmount,
      total_ot_regular_holiday_amount: totalOtRegularHolidayAmount,
      total_ot_rd_regular_holiday_amount: totalOtRdRegularHolidayAmount,
      total_ot_rd_special_holiday_amount: totalOtRdSpecialHolidayAmount,
      total_overtime_amount: totalOvertimeAmount,

      total_thirteen_month_pay: totalThirteenMonthPay,
      total_sss_share: totalSssShare,
      total_pag_ibig_share: totalPagIbigShare,
      total_phil_health_share: totalPhilHealthShare,
      total_payroll: totalPayroll,
      total_asf: totalAsf,
      total_allowance: totalAllowance,
      total_vat: totalVat,
      total_with_vat: totalWithVat,
      total_tax: totalTax,
      total_net_of_tax: totalNetOfTax,
      total_cash_bond: totalCashBond,
      total_billing: totalBilling,
    };
  }
}