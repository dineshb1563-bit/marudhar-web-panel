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
const styles = StyleSheet.create({
     topText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 0,
    paddingHorizontal: 10,

  },
  smallText: {
    fontSize: 10,
    color: '#000',
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
    fontSize: 25,
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
  headerBox:{
    width:'100%'
  }
})
const PdfHeaderCom = () => {
  return (
 <View style={styles.headerBox}>

      <View style={styles.topText}>
            <Text style={styles.smallText}>॥ श्री सोनाणा खेतलाजी नमः ॥</Text>
            <Text style={styles.smallText}>॥ श्री गणेशाय नमः ॥</Text>
            <Text style={styles.smallText}>॥ श्री सुन्धा माताजी नमः ॥</Text>
          </View> 
           <View style={styles.headerSection}>
        <Image 
                    src="/Images/marudhar_logo.png" 
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
                    {/* <View style={styles.schemeBox}>
                      <Text style={styles.schemeText}>{selectedProgram?.hiname}</Text>
                    </View> */}
                  </View>
      
                
                </View>
    </View>
  )
}

export default PdfHeaderCom
