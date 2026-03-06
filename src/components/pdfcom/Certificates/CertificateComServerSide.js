import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  PDFViewer, 
  Font,
  Image
} from '@react-pdf/renderer';
import NotoSansDevanagari from '@/app/api/helperfile/static/font/NotoSansDevanagari';
import NotoSansDevanagariBold from '@/app/api/helperfile/static/font/NotoSansDevanagariBold';
import logo from '@/app/api/helperfile/Images/logo';
import krinshnaImage from '@/app/api/helperfile/Images/KrinshnaImage';
import frameImg from '@/app/api/helperfile/Images/frameImg';
import StampImg from '@/app/api/helperfile/Images/stampImg';


// Register Devanagari Font
Font.register({
  family: 'NotoSansDevanagari',
  fonts: [
    {
      src: NotoSansDevanagari,
      fontWeight: 'normal',
    },
    {
      src:NotoSansDevanagariBold,
      fontWeight: 'bold',
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'NotoSansDevanagari',
    width: '210mm',
    height: '148mm',
    position: 'relative',
  },
  outerBorder: {
    // border: '4px solid #d4af37',
    padding: 15,
    height: '100%',
    position: 'relative',
    borderRadius: 4,
  },
  innerBorder: {
    // border: '2px solid #d4af37',
    padding: 14,
    height: '100%',
    borderRadius: 2,
    position: 'relative',
  },
  topText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    marginTop:5,
    paddingHorizontal: 50,
  },
  smallText: {
    fontSize: 9,
    color: '#8B0000',
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
 headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
  
  },
  logoImage: {
    width: 68,
    height: 68,
    borderRadius: 4,
  },
  logoImage1: {
    width: 78,
    height: 68,
    borderRadius: 4,
    position: 'absolute',
    left: 10,
     top: 10,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    marginLeft: 30,
  },
  mainTitle: {
    fontSize: 27,
    color: '#8B0000',
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subTitle: {
    fontSize: 13,
    color: '#000',
    fontWeight: 'bold',
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  address: {
    fontSize: 10,
    color: '#884a17',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 3,
    lineHeight: 1.3,
    paddingHorizontal: 10,
  },
  phoneNumbers: {
    fontSize:10,
    color: '#884a17',
    fontWeight: 'bold',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  regNotext:{
    fontSize: 9,
    color: '#000',
    fontWeight: 'bold',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  schemeBox: {
    backgroundColor: '#1a0f5e',
    borderRadius: 14,
    paddingVertical: 3,
    paddingHorizontal: 14,
    alignSelf: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },

  schemeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  formSection: {
    marginTop: 9,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 7,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 9.5,
    color: '#000',
    marginRight: 4,
    fontWeight: 'normal',
  },
  value: {
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
    borderBottom: '1px dotted #000',
    paddingBottom: 2,
    paddingHorizontal: 5,
    minHeight: 16,
    textTransform:'capitalize'
  },
  memberIdBox: {
    position: 'absolute',
    right: 18,
    top: 125,
    border: '2px solid #333',
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 3,
    overflow: 'hidden',
  },
  memberIdText: {
    fontSize: 8,
    textAlign: 'center',
    color: '#666',
    marginTop: 2,
  },
  memberIdLabel: {
    fontSize: 8,
    textAlign: 'center',
    color: '#666',
    paddingTop: 10,
  },
  detailsSection: {
    marginTop: 6,
    fontFamily: 'NotoSansDevanagari',
    fontSize: 8.5,
    color: '#000',
    textAlign: 'justify',
    lineHeight: 1.4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#fafafa',
    borderRadius: 2,
    border: '0.5px solid #ddd',
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // alignItems: 'flex-end',
    // marginTop: 'auto',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  leftFooter: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '45%',
  },
  rightFooter: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '45%',
  },
  footerLabel: {
    fontSize: 9,
    color: '#000',
    marginTop:5,
    fontWeight: 'bold',
  },
  footerValue: {
    fontSize: 9.5,
    color: '#000',
    fontWeight: 'bold',
    borderBottom: '1px dotted #000',
    paddingBottom: 8,
    paddingTop: 1,
    minWidth: 140,
    textAlign: 'center',
    marginTop: 2,
  },
  signatureText: {
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'right',
    borderTop: '1px solid #000',
    paddingTop: 3,
    minWidth: 140,
  },
  serialNumber: {
    position: 'absolute',
    top: -10,
    right: 24,
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  fieldGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 2,
  },
  watermark: {
    position: 'absolute',
    top: '28mm',
    left: '42mm',
    width: '115mm',
    height: '85mm',
    opacity: 0.08,
    zIndex: 0,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  donationHighlight: {
    backgroundColor: '#fff3cd',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  stamImg:{
    width: 120,
    height: 70,
    position: 'absolute',
    bottom: -20,
     right: 40,
                                       }
                                       ,
                                       framesImg:{
    position: 'absolute',
    top: 0,
    left: 0,
    
    width: '100%',
    height: '100%',
    zIndex: 1,
  },  
    footerLabelBox2:{
        width:'100%',
    position:'absolute',
    bottom:-35
,
left:0,
textAlign:'center'
  },
                                       
});

const CertificateServerSide = ({data,selectedProgram,fontPath}) => (
  <Document>
    <Page size={{ width: '210mm', height: '148mm' }} style={styles.page}>
      <Image style={styles.framesImg} src={frameImg}/>
      <View style={styles.outerBorder}>
        
        {/* <Text style={styles.serialNumber}>{data?.registrationNumber}</Text> */}
        <View style={styles.innerBorder}>
          {/* Top Text */}
          <View style={styles.topText}>
          <Text style={styles.smallText}>॥ श्री सोनाणा खेतलाजी नमः ॥</Text>
                   <Text style={styles.smallText}>॥ श्री गणेशाय नमः ॥</Text>
                   <Text style={styles.smallText}>॥ श्री सुन्धा माताजी नमः ॥</Text>
          </View> 

          {/* Watermark */}
          <Image 
           src={logo}
            style={styles.watermark}
          />

          {/* Header Section */}
                <View style={styles.headerSection}>
          <Image 
                      src={logo}  
                      style={styles.logoImage1}
                    />
                    <View style={styles.centerContent}>
                      <Text style={styles.mainTitle}>मरुधर जन कल्याण सेवा संस्थान</Text>
                      <Text style={styles.address}>
                        कार्यालय पता : मु. पो. गेलावास तह. रोहट जिला - पाली ( राजस्थान) 306421
                      </Text>
                      <Text style={styles.phoneNumbers}>
                   संथापक : D.R. Bhati 99823 04730 / 90793 91818
                      </Text>
                       <Text style={styles.regNotext}>
                  Regd No. COOP/2025/PALI/500486
                      </Text>
                      <View style={styles.schemeBox}>
                        <Text style={styles.schemeText}>{selectedProgram?.hiname}</Text>
                      </View>
                    </View>
        
                  
                  </View>

          {/* Member ID Box */}
          <View style={styles.memberIdBox}>
            {data?.photoURL ? (
              <Image src={data.photoURL} style={styles.photoImage} />
            ) : (
              <View>
                <Text style={styles.memberIdLabel}>सदस्य फोटो</Text>
              </View>
            )}
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Row 1 */}
            <View style={[styles.row,{
              justifyContent:'space-between',
              marginRight:55
            }]}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>सदस्यता क्रमांक:</Text>
                <Text style={[styles.value, { minWidth: 90 }]}>{data?.registrationNumber || '---'}</Text>
              </View>
              <View style={[styles.fieldGroup, { marginLeft: 20,marginRight:40 }]}>
                <Text style={styles.label}>दिनांक:</Text>
                <Text style={[styles.value, { minWidth: 60 }]}>{data?.dateJoin || '---'}</Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>नाम:</Text>
                <Text style={[styles.value, { minWidth: 150 }]}>{data?.displayName || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>पिता/पति का नाम:</Text>
                <Text style={[styles.value, { minWidth: 150 }]}>{data?.fatherName || '---'}</Text>
              </View>
            </View>

            {/* Row 3 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>गोत्र:</Text>
                <Text style={[styles.value, { minWidth: 90 }]}>{data?.gotra || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>जाति:</Text>
                <Text style={[styles.value, { minWidth:100}]}>{data?.jati || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>जन्म दि.:</Text>
                <Text style={[styles.value, { minWidth: 110 }]}>{data?.bobDate || '---'}</Text>
              </View>
            </View>

            {/* Row 4 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>मोबाईल नंबर:</Text>
                <Text style={[styles.value, { minWidth: 140 }]}>{data?.phone || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>गाँव/शहर का नाम:</Text>
                <Text style={[styles.value, { minWidth: 135 }]}>{data?.village || '---'}</Text>
              </View>
            </View>

            {/* Row 5 */}
            <View style={styles.row}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>जिला:</Text>
                <Text style={[styles.value, { minWidth: 160 }]}>{data?.district || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>राज्य:</Text>
                <Text style={[styles.value, { minWidth: 180 }]}>{data?.state || '---'}</Text>
              </View>
            </View>

            {/* Row 6 */}
            <View style={styles.row}>
                  <View style={styles.fieldGroup}>
                <Text style={styles.label}>वारिसदार:</Text>
                <Text style={[styles.value, { minWidth: 160 }]}>{data?.guardian  || '---'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>प्रत्येक {selectedProgram?.isSuraksha?'देहांत':selectedProgram?.isMamera?"मायरा":'विवाह'} पर सहयोग राशि:</Text>
                <Text style={[styles.value, { minWidth: 70}]}>
                  {data?.payAmount || '0'}/-
                </Text>
                <Text style={styles.label}>रुपये</Text>
              </View>
            </View>
          </View>

          {/* Details Section */}
          {
          //    <View style={styles.detailsSection}>
          // <Text style={{
          //                fontSize: 13,
          //                color: '#000'
          //                }}>
          //                संस्था में योगदान के लिए आपको सह धन्यवाद
          //              </Text>
          // </View>
          }
       

          {/* Footer Section */}
          <View style={styles.footerSection}>
            {/* Left Side - Karyakarta */}
            <View style={styles.leftFooter}>
              <Text style={styles.footerValue}>{data?.addedByName || '---'} ({data.agentPhone})</Text>
              <Text style={styles.footerLabel}>कार्यकर्ता </Text>
            </View>

            {/* Right Side - Signature */}
            <View style={styles.rightFooter}>
               <Image style={styles.stamImg} src={StampImg}/>
              {/* <Text style={styles.footerValue}>राजेंद्र कुमार बाबूलाल घांची</Text> */}
              {/* <Text style={styles.footerLabel}>संस्थापक</Text> */}
              <Text style={styles.signatureText}>हस्ताक्षर</Text>
            </View>
               <View style={styles.footerLabelBox2}>
            
                        <Text style={{
                          fontSize: 11,
                          color: '#884a17'
                        }}>
                          नोट: प्रमाण-पत्र संभाल कर रखें। यह आपकी सदस्यता का आधिकारिक दस्तावेज़ है।
                        </Text>
                        </View>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);

export default CertificateServerSide;