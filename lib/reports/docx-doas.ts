import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { DoasDocxParams } from '@/lib/types/deed';

const FONT_FAMILY = 'Times New Roman';
const TITLE_SIZE = 26; // 13pt
const HEADING_SIZE = 23; // 11.5pt
const BODY_SIZE = 22; // 11pt
const SMALL_SIZE = 19; // 9.5pt

const NO_BORDER = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'auto',
};

const BORDERLESS_TABLE_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

export async function generateDoasDocx(p: DoasDocxParams): Promise<Blob> {
  const isMarried =
    p.vendeeCivilStatus?.toLowerCase() === 'married' && Boolean(p.vendeeSpouseName);
  const civilClause = isMarried
    ? `married to ${p.vendeeSpouseName}`
    : (p.vendeeCivilStatus ?? 'single');

  const defaultTechDesc =
    'Beginning at a point marked "1" on plan being N. 14 deg. 24\' W., 1970. 41 m from corner 1, of E-135, thence N. 38°E ., 397.01 m to point 2 ; thence N. 3 deg. 45\'W., 123.41 m. to the point of beginning.;';
  const defaultBoundaryMarkers =
    'point 1 by old P. L.S./ B.L. conc, Mons., point 2 by old cross on trees; points 3 and 4 by P.L.S . cyl mons., and point 5 by old corner.';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // 8.5 inches (Legal width)
              height: 20160, // 14 inches (Legal height)
            },
            margin: {
              top: 1440, // 1 inch
              bottom: 1440, // 1 inch
              left: 1800, // 1.25 inches for folder binding
              right: 1440, // 1 inch
            },
          },
        },
        children: [
          // Document Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: 'DEED OF SALE WITH RESERVATION OF TITLE',
                bold: true,
                size: TITLE_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Opening Salutation
          new Paragraph({
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: 'KNOW ALL MEN BY THESE PRESENTS:',
                bold: true,
                size: HEADING_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Entry Clause
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 180 },
            children: [
              new TextRun({
                text: `This DEED, made and entered into this ${p.executionDay} day of ${p.executionMonth}, ${p.executionYear} at ${p.executionVenue}, Philippines, by and between:`,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Vendor Representation Block
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { left: 540, right: 360 },
            spacing: { line: 276, after: 180 },
            children: [
              new TextRun({
                text: `${p.vendorName}, `,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `represented by its ${p.vendorRepTitle}, `,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `${p.vendorRepresentative}`,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `, of legal age, Filipino, ${p.vendorRepCivilStatus} and a resident of Davao City, Philippines, hereinafter referred to as the `,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: 'VENDOR;',
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Separator
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: '- And -',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Vendee Representation Block
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { left: 540, right: 360 },
            spacing: { line: 276, after: 240 },
            children: [
              new TextRun({
                text: `${p.vendeeName}`,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `, of legal age, Filipino, ${civilClause} and a resident of ${p.vendeeAddress}, Philippines, hereinafter referred to as the `,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: 'VENDEE;',
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Witnesseth Heading
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 220 },
            children: [
              new TextRun({
                text: 'W I T N E S S E T H :',
                bold: true,
                size: HEADING_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Recital 1: Atty-in-fact authority & mother title
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 180 },
            children: [
              new TextRun({
                text: `WHEREAS, THE VENDOR is the Atty. In-fact of the Real Estate Property Owner by virtue of the Exclusive Marketing Agreement & Special Power of Attorney denominated as Doc. No. ${p.spaDocNo ?? '349'}, Page No. ${p.spaPageNo ?? '70'} , Book No. ${p.spaBookNo ?? '27'}, Series of ${p.spaSeries ?? '2002'} by ${p.spaNotary ?? 'ATTY. RODOLFTON S.J. DE LEON'}, that certain parcel of land embraced in and covered by OCT No. `,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `${p.motherTitleNumber ?? 'T-14913 & 14914'}`,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: ` of the Registry of Deeds for Davao Province, containing an approximate area of `,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `${p.motherAreaWords ?? 'ONE HUNDRED NINETY FOUR THOUSAND FOUR HUNDRED SIXTY SIX'} (${p.motherAreaSqm ?? '194,466'}) SQUARE METERS`,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `, more or less, situated at ${p.projectLocation ?? 'Kaputian District, Island Garden City of Samal'}.`,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Recital 2: Subdivision of land
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 180 },
            children: [
              new TextRun({
                text: 'WHEREAS, by authority thereof, the said VENDOR subdivided the aforestated property into home lots partitioning for sale and disposition to willing and interested buyers:',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Operative Clause: Consideration & Conveyance
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 180 },
            children: [
              new TextRun({
                text: 'NOW THEREFORE, for and in consideration of the sum of ',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `${p.considerationWords} (Php${p.considerationAmount}) PESOS`,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: ', Philippine Currency, paid in hand to the VENDOR by the VENDEE, do hereby SELL, TRANSFER & CONVEY, absolutely and unconditionally, unto and in favor the said VENDEE, that certain real property consisting of ONE (1) lot, under ',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `Block ${p.blockNumber}, Lot ${p.lotNumber}`,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: ` with an approximate area or a total of `,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `${p.lotAreaWords ?? 'ONE HUNDRED FIFTY'} (${p.lotAreaSqm}) SQUARE METERS`,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `, more or less, of which lot surveyed and being part and portion of OCT/TCT No. ${p.motherTitleNumber ?? 'T-14913 & 14914'} of the above stated and described subject property. ${p.technicalDescription?.trim() ? p.technicalDescription.trim() : defaultTechDesc}`,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Points on plan & monuments
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 180 },
            children: [
              new TextRun({
                text: `All points referred to as indicated on the plan and are marked on the ground as follows: ${p.boundaryMarkers?.trim() ? p.boundaryMarkers.trim() : defaultBoundaryMarkers}`,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Registered owner covenant
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 180 },
            children: [
              new TextRun({
                text: 'And containing of the above-mentioned lot area of which the original owner of the Title is the registered absolute owner in accordance with the Land Registration Commission of the records of the Office of the Registry of Deeds, Davao Province, Philippines.',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Survey and title expenses covenant
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 200 },
            children: [
              new TextRun({
                text: 'It is hereby mutually agreed that the VENDOR shall provide the approval of survey and likewise the VENDEE shall bear the expenses for the issuance of the new title to the said subject property.',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // --- PAGE BREAK FOR PAGE 2 ---
          new Paragraph({
            children: [new PageBreak()],
          }),

          // Header note for page 2
          new Paragraph({
            spacing: { after: 220 },
            children: [
              new TextRun({
                text: 'Deed of Sale with Reservation of Title\nPage 2 of 2',
                italics: true,
                size: SMALL_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // In Witness Whereof
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 360 },
            children: [
              new TextRun({
                text: `IN WITNESS WHEREOF, we have hereunto signed this Deed of Sale with Reservation of Title this ${p.executionDay} day of ${p.executionMonth}, ${p.executionYear} at ${p.executionVenue}, Philippines.`,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Signature Block Table (2 Columns)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: BORDERLESS_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  // Left: Vendee
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: BORDERLESS_TABLE_BORDERS,
                    children: [
                      new Paragraph({
                        spacing: { after: 80 },
                        children: [
                          new TextRun({
                            text: p.vendeeName,
                            bold: true,
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 60 },
                        children: [
                          new TextRun({
                            text: 'Vendee',
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 180 },
                        children: [
                          new TextRun({
                            text: p.vendeeTin ? `TIN: ${p.vendeeTin}` : 'TIN: _________________',
                            size: SMALL_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      ...(isMarried && p.vendeeSpouseName
                        ? [
                            new Paragraph({
                              spacing: { after: 180 },
                              children: [
                                new TextRun({
                                  text: 'With my marital consent:',
                                  size: BODY_SIZE,
                                  font: FONT_FAMILY,
                                }),
                              ],
                            }),
                            new Paragraph({
                              spacing: { after: 60 },
                              children: [
                                new TextRun({
                                  text: p.vendeeSpouseName,
                                  bold: true,
                                  size: BODY_SIZE,
                                  font: FONT_FAMILY,
                                }),
                              ],
                            }),
                          ]
                        : []),
                    ],
                  }),

                  // Right: Vendor
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: BORDERLESS_TABLE_BORDERS,
                    children: [
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: 'FIRST DAVAO MILLENNIUM PROPERTY',
                            bold: true,
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: 'VENTURES SERVICES, INC.',
                            bold: true,
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 240 },
                        children: [
                          new TextRun({
                            text: `BY: (${p.vendorRepTitle})`,
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 60 },
                        children: [
                          new TextRun({
                            text: p.vendorRepresentative,
                            bold: true,
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 60 },
                        children: [
                          new TextRun({
                            text: 'Vendor',
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Co. TIN: ${p.vendorTin ?? '005-212-468'}`,
                            size: SMALL_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Witness Section
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 120 },
            children: [
              new TextRun({
                text: 'SIGNED IN THE PRESENCE OF:',
                bold: true,
                size: HEADING_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: '____________________________________     &     ____________________________________',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Acknowledgment Heading
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'A C K N O W L E D G M E N T',
                bold: true,
                size: HEADING_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Venue Block
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: 'REPUBLIC OF THE PHILIPPINES)',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: 'CITY OF DAVAO-------------------)S.S',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: 'X-------------------------------------X',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Acknowledgment Narrative
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 160 },
            children: [
              new TextRun({
                text: `BEFORE ME, a Notary Public for and in the city of Davao, this _____ day of ____________, ${p.executionYear} personally appeared `,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: p.vendeeName,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: ` with his/her ID/Res. Cert. No. ${p.vendeeIdNumber ?? '___________'} and `,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: p.vendorRepresentative,
                bold: true,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: ` with his/her Res. Cert. No. ${p.vendorRepResCertNo ?? '01665165'} issued on ${p.vendorRepResCertDate ?? 'January 06, 2014'} at ${p.vendorRepResCertPlace ?? 'IGACOS'}, Philippines, known to me and to me known to be the same person who executed the foregoing instrument and acknowledged to me that the same is their own free and voluntary act and deed.`,
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Instrument Pages Reference
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 276, after: 180 },
            children: [
              new TextRun({
                text: 'This instrument refers to the Deed of Sale with Reservation of Title consisting of two (2) pages including this page in which this acknowledgment is written, duly signed by the parties together with their instrumental witnesses on each and every page hereof.',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Seal Line
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: 'WITNESS MY HAND AND SEAL, on the date, place above - written.',
                size: BODY_SIZE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Notary Public Block
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: BORDERLESS_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    borders: BORDERLESS_TABLE_BORDERS,
                    children: [
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: 'Doc. No. ________;',
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: 'Page No. ________;',
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: 'Book No. ________;',
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Series of ${p.executionYear}.`,
                            size: BODY_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    borders: BORDERLESS_TABLE_BORDERS,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 180 },
                        children: [
                          new TextRun({
                            text: 'NOTARY PUBLIC',
                            bold: true,
                            size: HEADING_SIZE,
                            font: FONT_FAMILY,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadDoasDocx(
  params: DoasDocxParams,
  filename?: string
): Promise<void> {
  const blob = await generateDoasDocx(params);
  const targetName =
    filename ??
    `DOAS_${params.vendeeName.replace(/[^\w.-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = targetName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
